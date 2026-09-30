import { Router } from 'express';
import {
  addData,
  bookEvent,
  changeData,
  joinClub,
  listData,
  removeData,
} from '../controllers/dataController.js';

const router = Router();

router.get('/', listData);
router.post('/clubs/:id/join', joinClub);
router.post('/events/:id/book', bookEvent);
router.post('/:sheet', addData);
router.patch('/:sheet/:id', changeData);
router.delete('/:sheet/:id', removeData);

export default router;