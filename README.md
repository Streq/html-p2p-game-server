# What This Is

If you ever played peer to peer games with friends, you had to do port-forwarding, which is a pain in the ass.

This is a simple barebones node project for a game lobby that uses STUN servers to handle the hassle of connecting players to each other. 
It uses Rock Paper Scissors as the placeholder game, given it is simple and turn based.

The server is only needed to establish connections between players and serve the game files, it does not do any game logic or validation, you can kill the server after a match starts and the match will still be up as long as the players are still connected to each other.

Basically, if you make a game and you wanna play it without having to rely on a server with your homies, you have to do port-forwarding, which is a pain in the ass for anyone who's not a huge nerd like you and me.

So the way this works is the following:
- You have your cool peer-to-peer game
- You have a public server both you and your desired playerbase can access (i.e. you can give people a url)
- Instead of port-forwarding in order to play, you:
  - give your homies an url (e.g. "examplegame.ex/room/mycoolroom")
  - whenever all parties entered the url, the game starts, and the server is no longer involved

# What This Is NOT

- a centralized server-client game with server-side logic/verification
- a completely serverless solution to peer-to-peer gaming
- a love letter to rock paper scissors
- a cheater-proof implementation (you can know what your opponent played if you look at the network messages directly through devtools, I wager you can fix this with encryption in some way but that's beyond the scope of this project)
