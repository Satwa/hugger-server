require('dotenv').config()

const Hapi      = require("hapi")
const Boom      = require("boom")
const hapiJWT   = require("hapi-auth-jwt2")
const { Sequelize, Op } = require('sequelize')
const sequelize 	= new Sequelize(process.env.DATABASE_URL, { logging: process.env.DATABASE_SHOW_LOG === "true" })
const firebaseAdmin = require("firebase-admin")
const Services = require("./Services")

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(require("./project-hifive-firebase-adminsdk.json")),
})

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
Chat.hasMany(Message, {foreignKey: "chat_id"})
Message.belongsTo(Chat, {foreignKey: "chat_id"})
User.hasMany(Message, {foreignKey: "sender_id"})
Message.belongsTo(User, {foreignKey: "sender_id"})

User.sync()
Chat.sync()
Message.sync()

const server = new Hapi.Server()

server.connection({
    port: process.env.PORT,
    routes: {
        cors: false
    }
})


server.register([
    require('./hapi-firebase-auth'),
    {
        register: require('./live'),
        options: {
            firebaseAdmin: firebaseAdmin
        }
    }
], (err) => {
    if(err) throw err
    server.auth.strategy('firebase', 'firebase', { firebaseAdmin })

    server.route({
        method: 'GET',
        path: '/auth',
        config: {
            auth: 'firebase'
        },
        handler: (req, reply) => {
            reply({ text: "Authentication OK." })
        }
    })

    server.route({
        method: 'POST',
        path: '/user',
        config: {
            auth: {
                strategy: 'firebase',
                mode: 'optional'
            }
        },
        handler: (req, reply) => {
            const data = req.payload

            User.build(data)
                .save()
                .then((res) => {
                    Services.assignHuggerToHuggy(data)
                    reply(true)
                })
                .catch((err) => console.log(err))
        }
    })

    server.route({
        method: 'GET',
        path: '/user/exists/{id}',
        config: {
            auth: 'firebase'
        },
        handler: async (req, reply) => {
            const user = await User.findOne({ where: { authID: req.params.id } })

            const res = {}
            res[req.params.id] = !!user
            console.log(res)
            reply(res)
        }
    })

    server.route({
        method: 'GET',
        path: '/user/me',
        config: {
            auth: 'firebase'
        },
        handler: async (req, reply) => {
            const user = await User.findOne({ where: { authID: req.auth.credentials.user_id } })
            reply(JSON.stringify(user))
        }
    })

    server.route({
        method: 'GET',
        path: '/user/{id}',
        config: {
            auth: 'firebase'
        },
        handler: async (req, reply) => {
            try{
                // Check if requester has access to requested by looking for chat relation
                    // If true, link is proved so we grant access to profile
                const chatExists = await Chat.findOne({ 
                    where: { 
                        [Op.or]: [
                            {
                                [Op.and]: [
                                    { user1: req.auth.credentials.user_id }, 
                                    { user2: req.params.id }
                                ]
                            },
                            {
                                [Op.and]: [
                                    { user2: req.auth.credentials.user_id },
                                    { user1: req.params.id },
                                ]
                            }
                        ]
                    } 
                })
                if(chatExists){ // TODO: query by authID only
                    const user = await User.findOne({ where: { [Op.or]: [{ authID: req.params.id }, { id: req.params.id }] } })
                    reply(JSON.stringify(user)) // TODO: This is not secure, some fields should not be shared publicly
                }else{
                    reply(Boom.unauthorized())
                }
            }catch(err){
                console.log(err)
                reply(Boom.internal())
            }
        }
    })

    server.route({
        method: 'POST',
        path: '/user/edit',
        config: {
            auth: 'firebase'
        },
        handler: (req, reply) => {
            // TODO
        }
    })

    server.start(() => console.log("Server up and running on port " + process.env.PORT))
})


/*

SOLID API:
  - /edit
    - Update and send to Firebase

LIVE API:
 - Mood update
    - emit when huggy
    - subscribe and receive when hugger
 - Chat
    - subscribe to rooms
    - update accordingly
    - save in database
    - save in memcache

///

Microservices :
 - Push Notifications
 - Firebase Storage

 - quickActions Triggerer (text analysis)
 - chatbot
*/

// Services.assignHuggerToHuggy({ type: "huggy", authID: "I6aQREjHKINZlkF8ljGmEIB2bv73"})