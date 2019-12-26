require('dotenv').config()

const Hapi      = require("hapi")
const Boom      = require("boom")
const hapiJWT   = require("hapi-auth-jwt2")
const Sequelize = require('sequelize')
const sequelize 	= new Sequelize(process.env.DATABASE_URL, { logging: process.env.DATABASE_SHOW_LOG === "true" })
const firebaseAdmin = require("firebase-admin")

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
    authID: Sequelize.STRING // Id given by Firebase when authenticating
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

Chat.hasMany(Message, {foreignKey: "chat_id"})
Message.belongsTo(Chat, {foreignKey: "chat_id"})

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

    // ROUTES
    require('./live')
], (err) => {
    if(err) throw err

    server.auth.strategy('firebase', 'firebase', {
        firebaseAdmin
    })

    // server.route({

    // })

    server.start(() => console.log("Server up and running on port " + process.env.PORT))
})



/*
headers: {
    'Authorization': `Bearer ${idToken}`
}

/////

request.auth.credentials
*/

/*

SOLID API:
 - /auth/verify
  - Check if token is ok (basically demo key)
 - /user
  - /me
    - Get my data + my chats (w/ huggies)
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
 - Affect hugger to huggy
 - Firebase JWT (already handled?)
 - Firebase Storage

 - quickActions Triggerer (text analysis)
 - chatbot
*/