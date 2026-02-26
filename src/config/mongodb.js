import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectMongoDB() {
    try {
        await mongoose.connect(env.mongoUri)

        
        
    } catch (error) {
        
    }
}