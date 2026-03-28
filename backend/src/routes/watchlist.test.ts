import { describe, it, expect, beforeAll, afterAll, beforeEach, jest, mock } from "bun:test";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import watchlistRoutes from "./watchlist.routes";
import { User, IUser } from "../models/User";
// import { authMiddleware } from "../middleware/auth.middleware";

// Mock firebase service
mock.module("../services/firebase.service", () => ({
    verifyIdToken: async (token: string) => {
        if (token === "valid-token") {
            return { uid: "test-uid", email: "test@example.com" };
        }
        return null;
    },
    initializeFirebase: () => { }
}));

const app = express();
app.use(express.json());
app.use("/api/watchlist", watchlistRoutes);

describe("Watchlist Routes", () => {
    // let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        // mongoServer = await MongoMemoryServer.create();
        // const uri = mongoServer.getUri();
        const uri = "mongodb://localhost:27017/streamtrack_test";
        await mongoose.connect(uri);
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        // await mongoServer.stop();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        // Create a test user
        await User.create({
            firebaseUid: "test-uid",
            email: "test@example.com",
            watchlist: []
        });
    });

    it("should add an item to the watchlist", async () => {
        const newItem = {
            contentId: "123",
            title: "Test Movie",
            type: "movie",
            posterPath: "/path.jpg",
            genre: "Action / Thriller"
        };

        const res = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer valid-token")
            .send(newItem);

        expect(res.status).toBe(201);
        expect(res.body.item.contentId).toBe("123");
        expect(res.body.item.status).toBe("want");
        expect(res.body.item.genre).toBe("Action / Thriller");

        const user = await User.findOne({ firebaseUid: "test-uid" });
        expect(user?.watchlist).toHaveLength(1);
        expect(user?.watchlist[0].contentId).toBe("123");
        expect(user?.watchlist[0].genre).toBe("Action / Thriller");
    });

    it("should get the watchlist", async () => {
        // Seed
        await User.findOneAndUpdate(
            { firebaseUid: "test-uid" },
            {
                $push: {
                    watchlist: {
                        contentId: "123",
                        title: "Test Movie",
                        type: "movie",
                        genre: "Drama",
                        status: "want",
                        addedAt: new Date()
                    }
                }
            }
        );

        const res = await request(app)
            .get("/api/watchlist")
            .set("Authorization", "Bearer valid-token");
        expect(res.status).toBe(200);
        expect(res.body.watchlist).toHaveLength(1);
        expect(res.body.watchlist[0].contentId).toBe("123");
        expect(res.body.watchlist[0].genre).toBe("Drama");
    });

    it("should update a watchlist item", async () => {
        // Seed
        await User.findOneAndUpdate(
            { firebaseUid: "test-uid" },
            {
                $push: {
                    watchlist: {
                        contentId: "123",
                        title: "Test Movie",
                        type: "movie",
                        genre: "Sci-Fi",
                        status: "want",
                        addedAt: new Date()
                    }
                }
            }
        );

        const res = await request(app)
            .put("/api/watchlist/123")
            .set("Authorization", "Bearer valid-token")
            .send({ status: "watched", rating: 8 });

        expect(res.status).toBe(200);
        expect(res.body.item.status).toBe("watched");
        expect(res.body.item.rating).toBe(8);

        const user = await User.findOne({ firebaseUid: "test-uid" });
        const item = user?.watchlist.find(i => i.contentId === "123");
        expect(item?.status).toBe("watched");
        expect(item?.genre).toBe("Sci-Fi");
    });

    it("should delete a watchlist item", async () => {
        // Seed
        await User.findOneAndUpdate(
            { firebaseUid: "test-uid" },
            {
                $push: {
                    watchlist: {
                        contentId: "123",
                        title: "Test Movie",
                        type: "movie",
                        status: "want",
                        addedAt: new Date()
                    }
                }
            }
        );

        const res = await request(app)
            .delete("/api/watchlist/123")
            .set("Authorization", "Bearer valid-token");
        expect(res.status).toBe(200);

        const user = await User.findOne({ firebaseUid: "test-uid" });
        expect(user?.watchlist).toHaveLength(0);
    });

    it("should get watchlist stats", async () => {
        // Seed multiple
        await User.findOneAndUpdate(
            { firebaseUid: "test-uid" },
            {
                $push: {
                    watchlist: {
                        $each: [
                            { contentId: "1", title: "M1", type: "movie", status: "want", addedAt: new Date() },
                            { contentId: "2", title: "S1", type: "tv", status: "watching", addedAt: new Date() },
                            { contentId: "3", title: "M2", type: "movie", status: "watched", addedAt: new Date() }
                        ]
                    }
                }
            }
        );

        const res = await request(app)
            .get("/api/watchlist/stats")
            .set("Authorization", "Bearer valid-token");
        expect(res.status).toBe(200);
        expect(res.body.stats.total).toBe(3);
        expect(res.body.stats.byStatus.want).toBe(1);
        expect(res.body.stats.byStatus.watching).toBe(1);
        expect(res.body.stats.byStatus.watched).toBe(1);
        expect(res.body.stats.byType.movie).toBe(2);
        expect(res.body.stats.byType.tv).toBe(1);
    });

    it("should reject invalid watchlist item type", async () => {
        const newItem = {
            contentId: "999",
            title: "Test Invalid Type",
            type: "podcast" // Invalid
        };

        const res = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer valid-token")
            .send(newItem);

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Type must be");
    });

    it("should reject invalid watchlist item status and rating", async () => {
        const newItem = {
            contentId: "888",
            title: "Test Invalid Status",
            type: "movie",
            status: "finished", // Invalid
            rating: 11 // Invalid
        };

        const res = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer valid-token")
            .send(newItem);

        expect(res.status).toBe(400);

        const res2 = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer valid-token")
            .send({ ...newItem, status: "watched" }); // Fix status, rating is still invalid

        expect(res2.status).toBe(400);
    });

    it("should reject update with invalid rating or status", async () => {
        // Seed
        await User.findOneAndUpdate(
            { firebaseUid: "test-uid" },
            {
                $push: {
                    watchlist: {
                        contentId: "update-test",
                        title: "Test Movie",
                        type: "movie",
                        status: "want",
                        addedAt: new Date()
                    }
                }
            }
        );

        const res = await request(app)
            .put("/api/watchlist/update-test")
            .set("Authorization", "Bearer valid-token")
            .send({ status: "invalid-status" });
        expect(res.status).toBe(400);

        const res2 = await request(app)
            .put("/api/watchlist/update-test")
            .set("Authorization", "Bearer valid-token")
            .send({ rating: -1 });
        expect(res2.status).toBe(400);
    });
});

