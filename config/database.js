/**
 * Database Configuration
 * MongoDB connection with Mongoose
 */

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

        // Drop stale unique index on inviteCodes.code that conflicts with sparse unique index
        // This index was auto-created by the old schema and causes E11000 duplicate key errors
        // when multiple companies have empty inviteCodes arrays (null values)
        try {
            const indexes = await mongoose.connection.db.collection('companies').indexes();
            const staleIndex = indexes.find(idx => idx.name === 'inviteCodes.code_1');
            if (staleIndex) {
                await mongoose.connection.db.collection('companies').dropIndex('inviteCodes.code_1');
                console.log('✅ Dropped stale inviteCodes.code_1 index (replaced by sparse unique index)');
            }
        } catch (idxErr) {
            console.log('ℹ️ Index cleanup skipped:', idxErr.message);
        }

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

        return conn;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;