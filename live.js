require('dotenv').config()
const { Sequelize, Op } = require('sequelize')
const sequelize 	    = new Sequelize(process.env.DATABASE_URL, { logging: process.env.DATABASE_SHOW_LOG === "true" })

const User = sequelize.define("users", {
    authID: {
        type: Sequelize.STRING, // ID given by Firebase when authenticating
        primaryKey: true
    },
    authorized: {
        type: Sequelize.BOOLEAN,
        defaultValue: false // false for hugger but true for huggy
    },
    birthdate: Sequelize.BIGINT,
    maxchild: {
        type: Sequelize.INTEGER,
        defaultValue: 3
    },
    name: Sequelize.STRING,
    picture: Sequelize.STRING,
    sex: Sequelize.STRING,
    story: Sequelize.STRING,
    type: Sequelize.STRING,
    deviceToken: Sequelize.STRING
})

const Chat = sequelize.define("chats", {
    user1: Sequelize.STRING,
    user2: Sequelize.STRING
})

const Message = sequelize.define("messages", {
    message: Sequelize.STRING
})

Chat.belongsTo(User, { foreignKey: "user1", as: "hugger" })
Chat.belongsTo(User, { foreignKey: "user2", as: "huggy" })
Chat.hasMany(Message, { foreignKey: "chat_id" })
Message.belongsTo(Chat, { foreignKey: "chat_id" })
User.hasMany(Message, { foreignKey: "sender_id" })
Message.belongsTo(User, { foreignKey: "sender_id" })

User.sync()
Chat.sync()
Message.sync()


exports.register = function (server, options, next) {
    let io = require('socket.io')(server.listener)

    const firebaseAdmin = options.firebaseAdmin

    io
        .use(async (socket, next) => {
            if(socket.handshake.query && socket.handshake.query.token){
                try{
                    const user = await firebaseAdmin.auth().verifyIdToken(socket.handshake.query.token)
                    socket.decoded = user
                    next()
                }catch(err){
                    // console.log("[DEBUG] LIVE API: Unauthorized user tried to access the API")
                    next(new Error("Authentication error"))
                }
            }else{
                // console.log("[DEBUG] LIVE API: Unauthorized user tried to access the API")
                next(new Error("Authentication error"))
            }
        })
        .on('connection', async function (socket) {
            console.log('[DEBUG] LIVE API: New connection')

            const user = await User.findOne({ where: { authID: socket.decoded.user_id } })
            const chatrooms = await Chat.findAll({
                attributes: ["id"],
                where: {
                    [Op.or]: [
                        { user1: socket.decoded.user_id },
                        { user2: socket.decoded.user_id },
                    ]
                },
                include: [Message, { model: User, as: "hugger" }, { model: User, as: "huggy" }]
            })
            
            socket.user = user
            socket.chatrooms = chatrooms
            for(const chatroom of chatrooms){ // Attach socket to every chatrooms it belongs to
                socket.join("chatroom" + chatroom.id)
            }

            socket.on('moodUpdate', (data) => {
                // console.log(socket)
                socket.user.update({
                    picture: data.picture
                })
                console.log("mood update")
                // Once updated, send to the chatroom
                io.to("chatroom" + socket.chatrooms[0].id).emit("moodUpdated", { room: "chatroom" + socket.chatrooms[0].id, picture: data.picture })
            })

            socket.on("chatList", () => {
                // Hugger here, we need to send them the accurate data
                socket.emit("chatListData", chatrooms.map($0 => $0.dataValues))
                // console.log(chatrooms.map($0 => $0.dataValues))
            })

            socket.on("sendMessage", (data) => {
                // TODO: Save data in database
                io.to(data.room).emit("newMessage", {
                    message: data
                })
            })
        })

    next()
}

exports.register.attributes = {
    name: 'hugger-live-api'
}

// TODO: Sockets are authenticated but we're not sure user has rights to send data to specific room