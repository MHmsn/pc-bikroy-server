const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
const { initializeApp } = require('firebase-admin/app');
//middlewares
app.use(cors());
app.use(express.json());
require("dotenv").config();

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.nhrod4k.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const categoryCollection = client.db("PCBikroy").collection("Categories");
    const usersCollection = client.db("PCBikroy").collection("Users");
    const productsCollection = client.db("PCBikroy").collection("Products");
    const ordersCollection = client.db("PCBikroy").collection("Orders");

    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoryCollection.find(query).toArray();
      res.send(categories);
    });
    app.get("/user", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      res.send(user);
    });
    app.get("/users", verifyJWT, async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const users = await usersCollection.find(query).toArray();

      res.send(users);
    });
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        return res.send({ accessToken: token });
      }
      console.log(user);
      res.status(403).send({ accessToken: "" });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.delete("/users",verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const filter = {email: email};
      const user = await usersCollection.findOne(filter);
      if(user?.role !== 'Admin'){
        return res.status(403).send({message: 'Forbidden Access'})
      }
      
      const uid = req.query.uid;
      const query = { uid: uid };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    app.put("/users/verify", verifyJWT, async(req, res) => {
      const email = req.decoded.email;
      const filter = {email: email};
      const user = await usersCollection.findOne(filter);
      if(user?.role !== 'Admin'){
        return res.status(403).send({message: 'Forbidden Access'})
      }
      
      const uid = req.query.uid;
      const query = { uid: uid };
      const tempUser = await usersCollection.findOne(query);
      console.log(tempUser)
      const options = {upsert: true};
      const updatedDoc = {
       $set: {
         verified: tempUser.verified ? false: true
       }
     }
      const result = await usersCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    })
  } finally {
  }
}

run().catch((e) => console.log(e));

app.get("/", async (req, res) => {
  res.send("PCB API running");
});

app.listen(port, () => {
  console.log(`PCB server running on ${port}`);
});
