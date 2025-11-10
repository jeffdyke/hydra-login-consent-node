import express from "express"
import jsonLogger from "../logging.js"

const router = express.Router();

router.head('/', (req, res) => {
  jsonLogger.info('HEAD / request received', { headers: req.headers });
  res.set('X-BondLink-Special', 'Head-Only-Value');
  res.status(200).end();
});


router.get('/', (req, res) => {
  jsonLogger.info('GET / request received', { headers: req.headers });
  res.set('X-BondLink-Special', 'Head-Only-Value');
  res.status(200).end();
});


router.post('/', (req, res) => {
  jsonLogger.info('POST / request received', { headers: req.headers });
  res.set('X-BondLink-Special', 'Head-Only-Value');
  res.status(200).end();
});


export default router
