import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
const url = "mongodb+srv://nitishkumar44470_db_user:RKCEbH9gUMaLAKmE@cluster0.bysxuff.mongodb.net/?appName=Cluster0";

async function run() {
  try {
    console.log("Connecting with Google DNS...");
    await mongoose.connect(url, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      family: 4,
    });
    console.log("Connected!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
run();
