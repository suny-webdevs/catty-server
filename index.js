require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
const jwt = require("jsonwebtoken")
var cookieParser = require("cookie-parser")

const app = express()
const port = process.env.PORT || 5000

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://catget-shop.web.app",
    "https://catget-shop.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded())
app.use(cookieParser())

app.get("/", (req, res) => {
  res.json({ success: true, message: "Welcome to Catty server" })
})

// Verify token middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access!" })
  }
  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      console.log(err)
      res.status(401).send({ message: "Unauthorized access!" })
    }
    req.user = decoded
    next()
  })
}

const client = new MongoClient(process.env.DATABASE_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const userCollection = client.db("cattyDB").collection("users")
    const productCollection = client.db("cattyDB").collection("products")
    const requestCollection = client.db("cattyDB").collection("requests")
    const wishListCollection = client.db("cattyDB").collection("wishLists")
    const cartCollection = client.db("cattyDB").collection("carts")

    // * Middlewares *
    // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const query = { email: req.user?.email }
      const result = await userCollection.findOne(query)
      if (!result || result?.role !== "admin") {
        return res.status(401).send({ message: "Unauthorized access!" })
      }
      next()
    }

    // verify seller
    const verifySeller = async (req, res, next) => {
      const query = { email: req.user?.email }
      const result = await userCollection.findOne(query)
      if (!result || result?.role !== "seller") {
        return res.status(401).send({ message: "Unauthorized access!" })
      }
      next()
    }

    // verify buyer
    const verifyBuyer = async (req, res, next) => {
      const query = { email: req.user?.email }
      const result = await userCollection.findOne(query)
      if (!result || result?.role !== "buyer") {
        return res.status(401).send({ message: "Unauthorized access!" })
      }
      next()
    }

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "12h",
      })
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true })
    })
    // logout api
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })

    //* Create user
    app.post("/create-user", async (req, res) => {
      try {
        const newUser = req.body
        const isExist = await userCollection.findOne({ email: newUser.email })
        if (isExist) {
          return res.status(200).send(isExist)
        }
        const postUser = await userCollection.insertOne(newUser)
        return res.status(200).json({
          success: true,
          message: "User created successfully!",
          postUser,
        })
      } catch (error) {
        return res
          .status(400)
          .json({ success: false, message: "Failed to create user!", error })
      }
    })

    //* Get all users
    app.get("/users", async (req, res) => {
      try {
        const users = await userCollection.find().toArray()
        return res.status(200).json({ users })
      } catch (error) {
        return res
          .status(400)
          .json({ success: false, message: "Failed to get users!", error })
      }
    })

    //* Get a single user
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email
        const user = await userCollection.findOne({ email })
        return res.json({ user })
      } catch (error) {
        return res.status(400).json({ message: "Failed to get user!", error })
      }
    })

    //* Update a single user
    app.patch("/update-role/:email", async (req, res) => {
      try {
        const email = req.params.email
        const user = await userCollection.findOne({ email })

        if (user?.role === "buyer") {
          const { modifiedCount, matchedCount } =
            await userCollection.updateOne(
              { email },
              { $set: { role: "seller" } }
            )
          res.status(200).json({ modifiedCount, matchedCount })
        }

        return res.status(300).json({ message: "User is already seller" })
      } catch (error) {
        return res.status(400).json({ message: "Failed to update!", error })
      }
    })

    //* Post product
    app.post("/create-product", async (req, res) => {
      try {
        const newProduct = req.body
        const data = await productCollection.insertOne(newProduct)
        return res.status(200).json({ message: "Product saved", data })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to create product!", error })
      }
    })

    //* Get all products
    app.get("/products", async (req, res) => {
      try {
        const products = await productCollection.find().toArray()
        return res.status(200).json({ products })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to get products!", error })
      }
    })

    //* Get a single product
    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id
        const product = await productCollection.findOne({
          _id: new ObjectId(id),
        })
        return res.status(200).json({ product })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to get product!", error })
      }
    })

    //* Update a product
    app.put("/update-product/:id", async (req, res) => {
      try {
        const product = req.body
        const id = req.params.id
        const data = await productCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: { ...product },
          },
          { upsert: true }
        )
        res.json({ message: "Product update successfully", data })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to update product!", error })
      }
    })

    //* Delete a product
    app.delete("/delete-product/:id", async (req, res) => {
      try {
        const id = req.params.id
        const data = await productCollection.deleteOne({
          _id: new ObjectId(id),
        })
        res.json({ message: "Product deleted successfully", data })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to delete product!", error })
      }
    })

    //* Create seller request
    app.post("/create-request", async (req, res) => {
      try {
        const newRequest = req.body
        const isExist = await requestCollection.findOne({
          email: newRequest?.email,
        })
        if (!isExist) {
          const { insertedId } = await requestCollection.insertOne(newRequest)
          if (insertedId)
            return res
              .status(200)
              .json({ message: "Request successful", insertedId })
        }
        return res.status(300).json({ message: "Already requested" })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to create request!", error })
      }
    })

    //* Get all request
    app.get("/requests", async (req, res) => {
      try {
        const requests = await requestCollection.find().toArray()
        return res.status(200).json({ requests })
      } catch (error) {}
    })

    //* Delete request
    app.delete("/delete-request/:email", async (req, res) => {
      try {
        const email = req.params.email
        const { deletedCount } = await requestCollection.deleteOne({ email })
        return res
          .status(200)
          .json({ message: "Request deleted", deletedCount })
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Failed to delete request!", error })
      }
    })

    //* Create wishlist
    app.post("/create-wishlist", async (req, res) => {
      try {
        const wishList = req.body
        const data = await wishListCollection.insertOne(wishList)
        res.json({ message: "Add to wishlist", data })
      } catch (error) {
        return res.status(400).json({ message: "Failed to add!", error })
      }
    })

    //* Create Cart
    app.post("/create-cart", async (req, res) => {
      try {
        const cart = req.body
        const data = await cartCollection.insertOne(cart)
        res.json({ message: "Add to cart", data })
      } catch (error) {
        return res.status(400).json({ message: "Failed to add!", error })
      }
    })

    await client.db("admin").command({ ping: 1 })
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
