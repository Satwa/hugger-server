const Handlers = require('./handlers')

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
                    console.log("LIVE API: Unauthorized user tried to access the API")
                    next(new Error("Authentication error"))
                }
            }else{
                console.log("LIVE API: Unauthorized user tried to access the API")
                next(new Error("Authentication error"))
            }
        })
        .on('connection', function (socket) {
            console.log('New connection!')

            socket.on('hello', Handlers.hello)
            socket.on('newMessage', Handlers.newMessage)
            socket.on('goodbye', Handlers.goodbye)
        })

    next()
}

exports.register.attributes = {
    name: 'hugger-live-api'
}