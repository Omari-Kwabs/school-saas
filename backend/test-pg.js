try {
  require('pg');
  console.log('PG OK');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
