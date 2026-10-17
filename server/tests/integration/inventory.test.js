const db = require('../helpers/db');
const Product = require('../../src/models/Product');
const { reserveStock, releaseStock } = require('../../src/services/inventory');
const { createProduct } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const line = (product, quantity) => ({ product: product._id, name: product.name, quantity });
const stockOf = async (product) => (await Product.findById(product._id)).stock;

describe('inventory service (with a real database)', () => {
  test('reserving takes stock off every product', async () => {
    const a = await createProduct({ stock: 5 });
    const b = await createProduct({ stock: 3 });

    await reserveStock([line(a, 2), line(b, 3)]);

    expect(await stockOf(a)).toBe(3);
    expect(await stockOf(b)).toBe(0);
  });

  test('if one line cannot be filled, stock already taken is put back', async () => {
    const plenty = await createProduct({ stock: 10 });
    const scarce = await createProduct({ name: 'Rare Hoya', stock: 1 });

    await expect(reserveStock([line(plenty, 4), line(scarce, 2)])).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Rare Hoya'),
    });

    expect(await stockOf(plenty)).toBe(10);
    expect(await stockOf(scarce)).toBe(1);
  });

  test('archived products cannot be reserved', async () => {
    const archived = await createProduct({ stock: 10, isActive: false });
    await expect(reserveStock([line(archived, 1)])).rejects.toMatchObject({ statusCode: 409 });
  });

  test('two shoppers racing for the last item: exactly one wins', async () => {
    const lastOne = await createProduct({ stock: 1 });

    const results = await Promise.allSettled([reserveStock([line(lastOne, 1)]), reserveStock([line(lastOne, 1)])]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stockOf(lastOne)).toBe(0);
  });

  test('releasing stock adds it back', async () => {
    const product = await createProduct({ stock: 2 });
    await releaseStock([line(product, 3)]);
    expect(await stockOf(product)).toBe(5);
  });
});
