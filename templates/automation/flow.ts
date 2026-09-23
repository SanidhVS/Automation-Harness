import { defineFlow } from '{{PRODUCT_NAME}}';

interface Params {
  // Declare your params here, matching manifest.json.
}

export default defineFlow<Params>(async ({ page, params, step, output, helpers, log }) => {
  await step('Open the site', async () => {
    await page.goto('https://example.com');
  });

  await step('Collect results', async () => {
    // helpers.collectUntil(...) for lists/pagination/infinite scroll; output.addRow(...)
    // or output.addRows(...) for CSV output, output.setJson(...) for JSON output.
  });

  await step('Verify', async () => {
    helpers.assert(output.rowCount > 0, 'Expected at least one result');
  });
});
