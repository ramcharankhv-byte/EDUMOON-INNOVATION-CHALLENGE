import { Router } from 'express';
import { widgetController } from '../controllers/widget.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { createWidgetSchema, updateWidgetSchema } from '../validators/widget.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', widgetController.getByBusinessId);
router.post('/', validateRequest(createWidgetSchema), widgetController.create);
router.put('/', validateRequest(updateWidgetSchema), widgetController.update);
router.delete('/', widgetController.delete);

export default router;
