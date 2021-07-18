const express = require("express");
const path = require('path')
const { RateLimiterMemory } = require('rate-limiter-flexible');
const customLogger = require('./logger.js')
const dotenv = require("dotenv")
const { MongoClient, Long } = require('mongodb');
const { performance } = require('perf_hooks');
const axios = require('axios');
const AxiosLogger = require("axios-logger")

let collection;
let systemsCollection;
let glbNamesCache = []
axios.interceptors.request.use(AxiosLogger.requestLogger)

axios.interceptors.response.use(AxiosLogger.responseLogger)

const PORT = process.env.port || 3000

//Boolean serverReady = false

dotenv.config()
const app = express()
app.use(express.static('../public/html', { extensions: ["html"] }))
app.use(express.static('../public'))
customLogger.dcsLog({"body": "Started", "title": "test"})

const URL = process.env.mongourl
const mongoClient = new MongoClient(URL, { useNewUrlParser: true, useUnifiedTopology: true });

const rateLimiter = new RateLimiterMemory({
  points: 3,
  duration: 1,
});

const rateLimiterMiddleware = (req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
        res.set({
            "Retry-After": rateLimiterRes.msBeforeNext / 1000,
            "X-RateLimit-Limit": 3,
            "X-RateLimit-Remaining": rateLimiterRes.remainingPoints,
            "X-RateLimit-Reset": new Date(Date.now() + rateLimiterRes.msBeforeNext)
        });
        res.status(429).json({ "error": "Rate limited, Too many requests."});
    });
};

app.use(rateLimiterMiddleware)

async function connect() {
    await mongoClient.connect(); 
    await mongoClient.db("new").command({ ping: 1 });
    console.log("Connected successfully to DSW's db and fetched main collection.");
    
    const database = mongoClient.db("database"); //todo use env
    collection = database.collection("new");
    systemsCollection = database.collection("system");
}
connect().catch(console.dir);

function bigIntToLong(bigint) {
    return new Long(Number(bigint & 0xFFFFFFFFn), Number((bigint >> 32n) & 0xFFFFFFFFn));
}

async function fetchUserInfo(userid, filter) {
    const deleteList = ["notifications","Inventory","cooldown","settings"]
    const result = await collection.findOne({ "userid": bigIntToLong(BigInt(userid)) });
    if (result) {
        for (const property of deleteList) {
            delete result[property];
        }
    }
    return result;
};

async function getBotStats() {
    const result = await systemsCollection.findOne({"type":"stats"})
    return result;
}

function checkInvalidDiscordID(id) {
    const regex = /^[0-9]{18,20}$/;
    if (!regex.test(id)) {
        return "Invalid ID";
    }
    return null;
}

async function getGlb(inName) {
    const glb = await collection.find().sort("Amount", -1).limit(6).toArray()
    if (!inName) {
        const result = {}
        for (const data of glb) {
            result[data.userid] = data.Amount
        }
        return result
    } else {
        const result = []
        var timeDiff = performance.now() - glbNamesCache[1];
        console.log(timeDiff)
        timeDiff = timeDiff /= 1000;
        console.log(timeDiff)
        if (timeDiff < 300) {
            console.log("using cache")
            return glbNamesCache[0]
        }
        for (const data of glb) {
            console.log(data.Amount)
            await axios.get(`https://discord.com/api/users/${data.userid}`, {
                headers: {
                    "Authorization": process.env.discordAPIAuth
                }
            })
                .then(function (response) {
                    result.push({ 
                                "name":  response.data.username,
                                "Amount": data.Amount
                                })
                })
                .catch(function (error) {
                    console.log(error);
                    result.push("error fetching")
                })
        }
        glbNamesCache = []
        glbNamesCache.push(result , performance.now())
        return result
    }
}

async function processData(oauthData) {
    const url = 'https://discord.com/api/users/@me'
    const config = {
        headers: {
            authorization: `${oauthData.token_type} ${oauthData.access_token}`,
        }
    }
    const userResult = await axios.get(url,config)
    console.log(userResult.data)
};

app.get('/api', (req, res) => {
    res.send("Hello world!<br>Check the documentation to learn about the API and its endpoints.")
});

app.get('/api/user/:userid', async (req, res) => {
    let notValid = checkInvalidDiscordID(req.params.userid);
    if (notValid) {
        return res.status(400).json({ "error": notValid });
    } 
    const result = await fetchUserInfo(req.params.userid);
    if (!result) {
        const error = "User associated with that id doesn't seem to be in our database.";
        const tip = "Make sure user has a dsw account";
        return res.status(404).json({ "error": error, "tip": tip });
    }
    res.json(result);
});

app.get('/api/glb', async (req, res) => {
    const params = req.query;

    if (params.name && params.name.toLowerCase() === "true") {
        res.json(await getGlb(true));
    }
    else {
        res.json(await getGlb(false));
    }
});

app.get('/api/stats', async (req, res) => {
    const result = await getBotStats();
    if (result) {
        res.json({ "guilds": result.guildCount, "members": result.memberCount, "commands": result.commandsCount});
    } else {
        return res.status(500).json({ "error": "Internal Database Error."})
    }
});

app.get('/api/login', async (req, res) => {
    //begad is segssy (and so is Nihal)
    const code = req.query.code
    if (code == null || code == "") {
        return res.redirect("/")
    }
 
    const url = "https://discord.com/api/oauth2/token"
    const params = new URLSearchParams();
    params.append("client_id", "658566989077544970")
    params.append("client_secret", process.env.client_secret)
    params.append("grant_type", "authorization_code")
    params.append("code", code)
    params.append("redirect_uri", 'http://localhost:3000/api/login')
    
    const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }
    axios.post(url, params, config)
    .then((result) => {
        processData(result.data)
        console.log("got result")
        res.json(result.data)
    })
    .catch((err) => { 
        console.log(err) //todo send error page to client
        res.send("Some error occured, contact nihal pez.") 
    })
                
    
});

app.listen(PORT , () => console.log(`Listening on port ${PORT} baby!`))