const express = require("express");
const cors = require("cors"); // cors middleware
require("dotenv").config(); // to reason of security
// const cloudinary = require("cloudinary").v2;
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // Mongo DB
const app = express();
const port = process.env.PORT || 5000; // call port where run the server
// middleware
app.use(cors());
// app.use(express.json());
app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb" }));
// app.use(express.urlencoded({ extended: true })); //
//
// DB_URI=mongodb+srv://docPortal:U3CJqc9biTUP6aqN@cluster0.vllpwyl.mongodb.net/?retryWrites=true&w=majority
// database connection
const uri = process.env.DB_URI;
// call mongo db client
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
//
async function dbConnect() {
  try {
    await client.connect();
    console.log("DB Connected");
  } catch (error) {
    console.log(error);
  }
}
// call to connect with db
dbConnect();
//
// ================================
// JWT middleware authorization
// ================================
//
// crate JWT (Json Web Token) from front end and send it to client end
app.post("/jwt", async (req, res) => {
  try {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "2d" });

    if (token) {
      return res.send({
        success: true,
        token: token,
        message: "Successfully token generated",
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Token generate fail!",
      });
    }
  } catch (error) {}
});
//
// Verify JWT
const verifyJWT = (req, res, next) => {
  // console.log(req.headers.authorization);
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).send({
      message: "Unauthorized Access",
      success: false,
      status: 401,
    });
  }
  const token = authorization.split(" ")[1]; // after split will get an array, after that we are taking array 1 key's value inside token variable.

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized Access",
        success: false,
        status: 401,
      });
    }
    req.decoded = decoded;
    next();
  });
};
//
// Verify JWT
app.get("/jwt", verifyJWT, async (req, res) => {
  const decodedUidFromJWT = req.decoded.uid;
  const uid = req.query.uid;
  // hwt verify that the uid matches
  if (uid !== decodedUidFromJWT) {
    return res.send({
      success: false,
      status: 403,
      message: "Forbidden Access",
    });
  }
  return res.send({
    success: true,
    status: 200,
    message: "Login Success",
  });
});
//
//==================================
// collections
//==================================
//
const usersCollection = client.db("refurbished").collection("users");
const productCollection = client.db("refurbished").collection("products");
const ordersCollection = client.db("refurbished").collection("orders");
const productReportCollection = client.db("refurbished").collection("productReports");

// test insert one
// const result = await usersCollection.insertOne({
//   name: "Test User"
// })

//=======================
// code block
//=======================
//
// save user email and generate jwt while login process
// if the user is already in collection then it will update or if not in collection it will create new.
// check user type while login to redirect user based dashboard
app.get("/usertype/:uid", async (req, res) => {
  const uid = req.params.uid;
  try {
    const user = await usersCollection.findOne({ uid: uid });
    if (user?._id) {
      return res.send({
        success: true,
        typeOfUser: user.role,
        message: "User Found",
      });
    } else {
      return res.send({
        success: false,
        message: "Data not found!",
      });
    }
  } catch (error) {
    return res.send({
      success: false,
      error: error.message,
    });
  }
});

app.put("/user/:uid", async (req, res) => {
  const uid = req.params.uid;
  // const email = req.params.email;
  const user = req.body;
  const filter = { uid: uid }; // filter by auth id of google firebase user
  const options = { upsert: true }; // if data not found in existing collection then create new one.
  const updateDoc = {
    $set: user,
  };

  try {
    const result = await usersCollection.updateOne(filter, updateDoc, options);

    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1d", // after 1 day the login jwt will expired automatically
    });
    if (result.acknowledged) {
      console.log(result);
      return res.send({
        success: true,
        result: result,
        token: token,
        message: `Successfully data inserted / updated`,
      });
    } else {
      return res.send({
        success: false,
        message: "Data insert fail!",
      });
    }
  } catch (error) {}
});
//
// Store product information
app.post("/product", verifyJWT, async (req, res) => {
  const product = req.body;

  try {
    const result = await productCollection.insertOne(product); // post data
    // success post data
    if (result.insertedId) {
      return res.send({
        success: true,
        insertedId: result.insertedId,
        message: `Product created successfully`,
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Data insert fail!",
      });
    }
  } catch (error) {
    // fail post data
    return res.send({
      success: false,
      message: error.message,
    });
  }
});
// Update product information
app.patch("/product/:id", verifyJWT, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await productCollection.updateOne({ _id: ObjectId(id) }, { $set: req.body });
    // success post data
    if (result.matchedCount) {
      return res.send({
        success: true,
        message: `Product Updated successfully`,
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Data insert fail!",
      });
    }
  } catch (error) {
    // fail post data
    return res.send({
      success: false,
      message: error.message,
    });
  }
});
// get products list
app.get("/products", verifyJWT, async (req, res) => {
  const uid = req.query.uid;
  const filter = { uid: uid };
  try {
    const result = await productCollection.find(filter).toArray();
    // success post data
    if (result) {
      return res.send({
        success: true,
        data: result,
        message: `Successfully fetched`,
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Data fetch fail!",
      });
    }
  } catch (error) {
    // fail post data
    return res.send({
      success: false,
      message: error.message,
    });
  }
});
// =====================
// front end API's
// =====================
// get advertised products only for front end
app.get("/productsAdvertised", async (req, res) => {
  const filter = { isAdvertise: true };
  try {
    const result = await productCollection.find(filter).toArray();

    let products = await Promise.all(
      // to fix promise pending issues, I used Promise.all()
      result.map(async (data) => {
        let product = data;
        const userVerify = await usersCollection.findOne({ uid: data.uid });
        //  console.log("user: ", userVerify);
        product.userVerified = userVerify.sellerIsVerified;
        product.sellerName = userVerify.name;
        return product;
        console.log(product);
      })
    );
    // success post data
    if (products) {
      return res.send({
        success: true,
        data: products,
        message: `Successfully fetched`,
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Data fetch fail!",
      });
    }
  } catch (error) {
    // fail post data
    return res.send({
      success: false,
      message: error.message,
    });
  }
});
// Product By Category
app.get("/productByCategory/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { categorySlug: id };
  try {
    const result = await productCollection.find(filter).toArray();

    let products = await Promise.all(
      // to fix promise pending issues, I used Promise.all()
      result.map(async (data) => {
        let product = data;
        const userVerify = await usersCollection.findOne({ uid: data.uid });
        //  console.log("user: ", userVerify);
        product.userVerified = userVerify.sellerIsVerified;
        product.sellerName = userVerify.name;
        return product;
        console.log(product);
      })
    );
    // success post data
    if (products) {
      return res.send({
        success: true,
        data: products,
        message: `Successfully fetched`,
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Data fetch fail!",
      });
    }
  } catch (error) {
    // fail post data
    return res.send({
      success: false,
      message: error.message,
    });
  }
});

//
//
app.get("/categories/:id", async (req, res) => {
  const filter = { isAdvertise: true };
  try {
    const result = await productCollection.find(filter).toArray();

    let products = await Promise.all(
      // to fix promise pending issues, I used Promise.all()
      result.map(async (data) => {
        let product = data;
        const userVerify = await usersCollection.findOne({ uid: data.uid });
        //  console.log("user: ", userVerify);
        product.userVerified = userVerify.sellerIsVerified;
        product.sellerName = userVerify.name;
        return product;
        console.log(product);
      })
    );
    // success post data
    if (products) {
      return res.send({
        success: true,
        data: products,
        message: `Successfully fetched`,
      });
    } else {
      // fail post data
      return res.send({
        success: false,
        message: "Data fetch fail!",
      });
    }
  } catch (error) {
    // fail post data
    return res.send({
      success: false,
      message: error.message,
    });
  }
});
//
//
// Verify the server is running or not
app.get("/", (req, res) => {
  try {
    res.send({
      success: true,
      message: "Server is running....",
    });
  } catch (error) {
    console.log(error.name, error.message);
    res.send({
      success: false,
      error: error.message,
    });
  }
});
//
// port Listening
app.listen(port, () => {
  // console.log(`Listening to port ${port}`);
});
