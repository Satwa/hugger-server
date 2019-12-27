require('dotenv').config()
const { Sequelize, Op } = require('sequelize')
const sequelize 	    = new Sequelize(process.env.DATABASE_URL, { logging: process.env.DATABASE_SHOW_LOG === "true" })

const User = sequelize.define("users", {
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
    authID: Sequelize.STRING, // ID given by Firebase when authenticating
    deviceToken: Sequelize.STRING
})

const Chat = sequelize.define("chats", {
    user1: Sequelize.INTEGER,
    user2: Sequelize.INTEGER
})

const Message = sequelize.define("messages", {
    // chat_id: Sequelize.INTEGER,
    message: Sequelize.STRING,
    sender: Sequelize.INTEGER
})

Chat.hasMany(Message, { foreignKey: "chat_id" })
Message.belongsTo(Chat, { foreignKey: "chat_id" })

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
        .on('connection', function (socket) {
            console.log('[DEBUG] LIVE API: New connection!')

            socket.on('moodUpdate', (data) => {
                User.findOne({ where: { authID: socket.decoded.user_id } })
                    .then((user) => {
                        user.update({
                            picture: data.picture
                        })
                    })
                // TODO: Emit to hugger
            })

            // socket.on('newMessage', Handlers.newMessage)
            // socket.on('goodbye', Handlers.goodbye)
        })

    next()
}

exports.register.attributes = {
    name: 'hugger-live-api'
}