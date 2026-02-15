const express = require("express");
const cors = require("cors");
const analysesRouter = require("./routes/analyses");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/analyses", analysesRouter);

app.use(errorHandler);

module.exports = app;
