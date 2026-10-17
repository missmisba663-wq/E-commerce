const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const auth = require('../controllers/authController');
const products = require('../controllers/productController');
const cart = require('../controllers/cartController');
const checkout = require('../controllers/checkoutController');
const orders = require('../controllers/orderController');
const admin = require('../controllers/adminController');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) }));

// Auth
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', protect, auth.me);

// Module 1: product catalogue (public)
router.get('/products', products.listProducts);
router.get('/products/categories', products.listCategories);
router.get('/products/:idOrSlug', products.getProduct);

// Module 2: cart
router.get('/cart', protect, cart.getCart);
router.post('/cart/items', protect, cart.addItem);
router.patch('/cart/items/:productId', protect, cart.updateItem);
router.delete('/cart/items/:productId', protect, cart.removeItem);
router.delete('/cart', protect, cart.clearCart);

// Module 3: checkout
router.post('/checkout/quote', protect, checkout.quote);
router.post('/checkout', protect, checkout.placeOrder);

// Module 4: order processing (customer side)
router.get('/orders', protect, orders.listMyOrders);
router.get('/orders/:id', protect, orders.getOrder);
router.post('/orders/:id/cancel', protect, orders.cancelMyOrder);

// Module 5: admin
const adminRouter = express.Router();
adminRouter.use(protect, adminOnly);
adminRouter.get('/stats', admin.getStats);
adminRouter.get('/products', admin.listProducts);
adminRouter.post('/products', admin.createProduct);
adminRouter.put('/products/:id', admin.updateProduct);
adminRouter.delete('/products/:id', admin.archiveProduct);
adminRouter.get('/orders', admin.listOrders);
adminRouter.patch('/orders/:id/status', admin.updateOrderStatus);
router.use('/admin', adminRouter);

module.exports = router;
