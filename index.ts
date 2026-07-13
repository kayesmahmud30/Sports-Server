import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
import express from "express";
import type { Request, Response, NextFunction } from "express";

import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";

const Port: string = process.env.PORT || "5000";
const app = express();
app.use(cors());
app.use(express.json());

const uri: string = process.env.MONGODB_URI || "";

app.listen(Port, () => {
  console.log(`server Running on ${Port}`);
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verify = async (req: Request, res: Response, next: NextFunction) => {
  const header = req?.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = header.split(" ")[1];

  if (!token) {
    console.log("Invalid scheme or empty token");
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    console.error(
      "JWT Verification failed Error Details:",
      (error as Error).message,
    );
    return res.status(403).json({ message: "Forbidden" });
  }
};

app.get("/", (_req: Request, res: Response) => {
  res.send("Server Is Running Fine");
});

interface FacilityDocument {
  _id?: string;
  facilityName?: string;
  facilityType?: string;
  imageUrl?: string;
  location?: string;
  pricePerHour?: number;
  capacity?: number;
  description?: string;
  ownerEmail?: string;
  availableTimeSlots?: string;
  [key: string]: unknown;
}

interface BookingDocument {
  _id?: string;
  user_name?: string;
  user_image?: string;
  user_id?: string;
  user_email?: string;
  facility_id?: string;
  facility_name?: string;
  facility_img?: string;
  booking_date?: string;
  time_slot?: string;
  hours?: number;
  total_price?: number;
  status?: string;
  [key: string]: unknown;
}

async function run() {
  try {
    const db = client.db("sportnest");
    const db_col = db.collection<FacilityDocument>("facilities_data");
    const db_col_2 = db.collection<BookingDocument>("bookings");

    app.post("/facility", async (req: Request, res: Response) => {
      const facilityData = req.body;
      const result = await db_col.insertOne(facilityData);
      res.send(result);
    });

    app.get("/facility", async (req: Request, res: Response) => {
      try {
        const { search, sport, ownerEmail } = req.query as {
          search?: string;
          sport?: string | string[];
          ownerEmail?: string;
        };

        const query: Record<string, unknown> = {};

        if (search) {
          query.facilityName = {
            $regex: search,
            $options: "i",
          };
        }

        if (sport && sport !== "All Facilities") {
          const sportFilter = Array.isArray(sport) ? sport : [sport];

          query.facilityType = {
            $in: sportFilter,
          };
        }

        if (ownerEmail) {
          query.ownerEmail = ownerEmail;
        }

        const result = await db_col.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Internal Server Error",
        });
      }
    });

    app.get("/facility/:id", verify, async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const result = await db_col.findOne({ _id: new ObjectId(id) } as any);
      res.send(result);
    });

    app.patch("/facility/:id", async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const updatedData = req.body;

      const result = await db_col.updateOne({ _id: new ObjectId(id) } as any, {
        $set: updatedData,
      });

      res.send(result);
    });

    app.delete("/facility/:id", verify, async (req: Request, res: Response) => {
      const id = req.params.id as string;

      const result = await db_col.deleteOne({
        _id: new ObjectId(id),
      } as any);

      res.send(result);
    });

    // for my Bookings

    app.post("/bookings", verify, async (req: Request, res: Response) => {
      const bookingData = req.body;
      const result = await db_col_2.insertOne(bookingData);
      res.send(result);
    });

    app.get(
      "/bookings/:userId",
      verify,
      async (req: Request, res: Response) => {
        const { userId } = req.params;

        const result = await db_col_2.find({ user_id: userId }).toArray();
        res.send(result);
      },
    );

    app.delete(
      "/bookings/:bookingId",
      verify,
      async (req: Request, res: Response) => {
        const bookingId = req.params.bookingId as string;
        const result = await db_col_2.deleteOne({
          _id: new ObjectId(bookingId),
        } as any);
        res.send(result);
      },
    );

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
