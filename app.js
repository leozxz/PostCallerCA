const express = require('express');
const bodyParser = require('body-parser');
const activityRouter = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static('public'));

// Activity endpoints
app.use('/activity', activityRouter);

// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`CA Post running on port ${PORT}`);
});
