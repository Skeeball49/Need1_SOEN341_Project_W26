# Database Setup Guide

This project uses **MongoDB Atlas** (free tier) for persistent data storage that works with the deployed Netlify version.

## Setup Instructions

### 1. Create a MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up for a free account
3. Create a new cluster (select the free M0 tier)
4. Wait for the cluster to be created (takes 1-3 minutes)

### 2. Configure Database Access

1. In MongoDB Atlas, go to **Database Access** (left sidebar)
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Create a username and password (save these!)
5. Set **Database User Privileges** to "Read and write to any database"
6. Click **Add User**

### 3. Configure Network Access

1. Go to **Network Access** (left sidebar)
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (or add `0.0.0.0/0`)
4. Click **Confirm**

### 4. Get Your Connection String

1. Go to **Database** (left sidebar)
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Select **Node.js** as the driver
5. Copy the connection string (looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`)
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password

### 5. Configure Local Environment

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   NODE_ENV=development
   ```

### 6. Configure Netlify Environment Variables

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add a new variable:
   - **Key**: `MONGODB_URI`
   - **Value**: Your MongoDB connection string
5. Click **Save**

### 7. Update Netlify Configuration

Make sure your `netlify.toml` includes the database files:

```toml
[functions]
  node_bundler = "esbuild"
  included_files = ["views/**", "partials/**", "db.cjs"]

[functions.server]
  external_node_modules = ["express", "ejs", "body-parser", "mongodb", "dotenv"]
```

### 8. Deploy

After setting up the environment variables in Netlify, redeploy your site:

```bash
git add .
git commit -m "Add MongoDB database integration"
git push
```

Netlify will automatically redeploy with the new database configuration.

## Database Structure

The application uses a single database: `soen341_project`

### Collections

#### `users`
```json
{
  "_id": ObjectId,
  "email": String,
  "password": String,
  "diet": String,
  "allergies": String
}
```

## Testing Locally

1. Make sure your `.env` file is configured
2. Run the development server:
   ```bash
   node index.js
   ```
3. Visit `http://localhost:3000`

## Troubleshooting

### Connection Issues
- Verify your IP address is whitelisted in MongoDB Atlas Network Access
- Check that your connection string is correct in `.env` and Netlify
- Ensure your database user has the correct permissions

### Deployment Issues
- Check Netlify function logs for errors
- Verify environment variables are set in Netlify dashboard
- Make sure `mongodb` and `dotenv` are in your `package.json` dependencies

## Security Notes

- **Never commit your `.env` file** - it's already in `.gitignore`
- Use strong passwords for your database users
- Consider using MongoDB's built-in encryption features for production
- In production, you should hash passwords (use bcrypt) instead of storing them in plain text
