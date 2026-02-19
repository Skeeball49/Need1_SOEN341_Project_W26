# Netlify Environment Variable Setup

## ⚠️ CRITICAL: Set MongoDB Environment Variable in Netlify

Your database is now integrated and tested locally ✅, but **you must add the MongoDB connection string to Netlify** for the live site to work.

## Steps to Configure Netlify:

### 1. Go to Your Netlify Dashboard
Visit: https://app.netlify.com/

### 2. Select Your Site
Click on your deployed site (Need1_SOEN341_Project_W26 or similar)

### 3. Navigate to Environment Variables
- Click **Site settings** (in the top navigation)
- Scroll down to **Environment variables** in the left sidebar
- Click **Environment variables**

### 4. Add MongoDB URI
Click **Add a variable** and enter:

**Key:** `MONGODB_URI`

**Value:** 
```
mongodb+srv://ogenyiobinna_db_user:u0PacRdZ1yAUlWWE@cluster0.fszyjts.mongodb.net/
```

**Scopes:** Select "All scopes" or at least "Functions"

### 5. Save and Redeploy
- Click **Save**
- Go to **Deploys** tab
- Click **Trigger deploy** → **Deploy site**

## Verify It's Working

After deployment completes (usually 2-3 minutes):

1. Visit your live site
2. Try to **register a new account**
3. Try to **login** with that account
4. Try to **update your profile preferences**

If any of these fail, check the Netlify function logs:
- Go to **Functions** tab in Netlify
- Click on the **server** function
- View the logs for error messages

## What Was Deployed

✅ MongoDB database integration
✅ User registration and login with database
✅ Profile preferences stored in database
✅ Mobile-responsive design
✅ Fixed registration form bug

## Local Testing Passed ✅

The database connection was successfully tested locally with:
- User registration
- User login
- Profile updates
- Duplicate email prevention

All tests passed! The only remaining step is setting the environment variable in Netlify.
