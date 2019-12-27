const { Sequelize, Op } = require('sequelize')
const sequelize         = new Sequelize(process.env.DATABASE_URL, { logging: process.env.DATABASE_SHOW_LOG === "true" })


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

exports.assignHuggerToHuggy = async (user_data) => { // TODO: Don't reach maxchild
    if(user_data.type == "huggy"){
        try {
            const huggers = await User.findAll({ where: { type: "hugger", authorized: 1 } })
            const chats   = await Chat.findAll()

            let pHuggers = [] // list of huggers' id with maxchild (potentialHuggers)
            let chat_ids = []
    
            for(const chat of chats){ // list all chat ids
                chat_ids.push(chat.user1 + "_" + chat.user2)
            }
    
            for(const hugger of huggers){
                pHuggers.push({
                    authID: hugger.authID,
                    appearance: chat_ids.filter($0 => $0.includes(hugger.authID)).length
                })
            }
    
            pHuggers.sort((a, b) => a.appearance > b.appearance) // sort huggers to have the least handling one first
            
            Chat.build({
                user1: pHuggers[0].authID,
                user2: user_data.authID,
            })
            .save()
            .then((data) => {
                console.log("[DEBUG] New huggy now linked to a hugger")
            })
        }catch(err) {
            console.error(err)
        }
    }
}