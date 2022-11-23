const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());
require('dotenv').config();

async function run(){
    try{

    }
    finally{
        
    }
}

run().catch(e =>console.log(e))


app.get('/', async(req,res) => {
    res.send("API running");
})

app.listen(port, () => {
    console.log(`server running on ${port}`)
})