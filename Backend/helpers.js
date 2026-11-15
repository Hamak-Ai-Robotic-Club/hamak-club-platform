import request from "supertest";
import app from "../src/app.js";

export const PASSWORD = "Team@12345";

export async function loginAgent(username) {
    const agent = request.agent(app);
    const res = await agent
        .post("/api/auth/login")
        .send({ username, password: PASSWORD });
    if (res.status !== 200) {
        throw new Error(`login failed for ${username}: ${res.status}`);
    }
    return agent;
}

export const requestBody = (items, projectName = "Test Project") => ({
    projectName,
    projectDescription: "Test description",
    items,
});

export const item = (componentId, quantity) => ({ componentId, quantity });