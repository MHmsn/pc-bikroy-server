const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")('sk_test_51M92PVKGeN6HPiFizP2BVnHnOlJqp1Ygsrxamz7MARNxcTCisyE2Cek63Nm0a1Lw9usAVlWZWxvjsxFaC2r9eBAw00etv0Lo6g');


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
    const paymentsCollection = client.db("PCBikroy").collection("Payments");


    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoryCollection.find(query).toArray();
      res.send(categories);
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      res.send(user);
    });

    app.get("/users", async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const users = await usersCollection.find(query).toArray();

      res.send(users);
    });

    app.get("/orders", verifyJWT, async (req, res) => {
      const buyer = req.query.uid;
      const decodedEmail = req.decoded.email;
            const filter = {email: decodedEmail};
            const user = await usersCollection.findOne(filter);
            if(user?.role !== 'Buyer'){
                return res.status(403).send({message: 'Forbidden Access'})
            }
      const query = {buyeruid: buyer};
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
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

    app.get("/products", async (req, res) => {
      const query = {sold: false, booked: false, reported: false}
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    app.get("/payment/:id", async (req, res) => {
      const id = req.params.id;
      const query = {productID: id};
      const result = await ordersCollection.findOne(query);
      res.send(result)
    })

    app.get("/reporteditems", async (req, res) => {
      const query = {reported: true}
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    app.get("/products/myproducts", async (req, res) => {
      const selleruid = req.query.selleruid;
      const query = {selleruid: selleruid}
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    app.get("/products/:id", async (req, res) => {
      const categoryID = req.params.id;
      const query = {sold: false, booked: false, reported: false}
      query.categoryID= categoryID;
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });
    
    app.get("/advertisedproducts", async (req, res) => {
      const query = {advertised: true, booked: false, sold: false, reported: false};
      
      const products = await productsCollection.find(query).toArray();
      res.send(products);


    });

    app.post('/create-payment-intent', async (req, res) => {
      const order =  req.body;
      const price = order.price;
      const cost = price*100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: cost,
        "payment_method_types": [
          "card"
        ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.orderId;
      const query = {productID: id};
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const option = {upsert: true};
      const updateResult = await ordersCollection.updateOne(query, updatedDoc, option)
      const productQuery = {_id: ObjectId(id)};
      const updatedProductDoc = {
        $set: {
          sold: true,
          transactionId: payment.transactionId
        }
      }
      const productResult = await productsCollection.updateOne(productQuery, updatedProductDoc, option)
      res.send(result);
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const userCheck = await usersCollection.findOne({email: user.email});
      if(!userCheck){
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
      else{
        res.send(userCheck);
      }
      
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const query = {_id: ObjectId(order.productID)};
      const tempProduct= await productsCollection.findOne(query);
      const updatedDoc = {
        $set: {
          booked: tempProduct.booked ? false: true
        }
      }
      const options = {upsert: true};
      const updateResult= await productsCollection.updateOne(query, updatedDoc, options);
      const result = await ordersCollection.insertOne(order);
      res.send(result);
      
    });

    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.delete("/users", verifyJWT, async (req, res) => {
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

    app.delete("/myproducts/delete", async (req, res) => {
      const id = req.query.id;
      console.log(id);
       const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/myproducts/advertise", async(req, res) => {
      const id = req.query.id;
      
      const query = { _id: ObjectId(id) };
      const tempProduct = await productsCollection.findOne(query);
      const options = {upsert: true};
      const updatedDoc = {
       $set: {
         advertised: tempProduct.advertised ? false: true
       }
     }
      const result = await productsCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    })

    app.put("/report", async(req, res) => {
      const id = req.query.id;
      const query = { _id: ObjectId(id) };
      const tempProduct = await productsCollection.findOne(query);
      const options = {upsert: true};
      const updatedDoc = {
       $set: {
         reported: tempProduct.reported ? false: true
       }
     }
      const result = await productsCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    })

    app.put("/users/verify",verifyJWT, async(req, res) => {
      const email = req.decoded.email;
      const filter = {email: email};
      const user = await usersCollection.findOne(filter);
      if(user?.role !== 'Admin'){
        return res.status(403).send({message: 'Forbidden Access'})
      }
      
      const uid = req.query.uid;
      const query = { uid: uid };
      const productQuery = { selleruid: uid };
      const tempUser = await usersCollection.findOne(query);
      const tempProducts = await productsCollection.find(productQuery).toArray();

      const productUpdatedDoc = {
        $set: {
          sellerVerified: tempProducts[0]?.sellerVerified ? false: true
        }
      }
      const options = {upsert: true};
      const productResult = await productsCollection.updateMany(productQuery, productUpdatedDoc, options);
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
