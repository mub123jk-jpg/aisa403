import express from "express";
import searchApi from "./api/searchApi";

const app = express();
app.use(express.json());

app.use("/api", searchApi);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Search API listening on http://localhost:${PORT}/api`);
});
