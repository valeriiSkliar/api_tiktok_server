import { Log } from 'crawlee';
import { Page } from 'playwright';

/**
 * Waits for the login modal to appear and clicks on the "Log in with phone/email" button
 * @param page - Playwright page object
 * @param log - Crawlee logger
 * @returns Promise that resolves when the operation is complete
 */
export async function selectPhoneEmailLogin(
  page: Page,
  log: Log,
): Promise<void> {
  log.info('Waiting for login modal and selecting phone/email login option');
  try {
    // Wait for the login modal to be visible
    await page.waitForSelector('div.LoginModal_main__I3imq', {
      timeout: 10000,
    });
    log.info('Login modal is visible');

    // Try different selectors for the "Log in with phone/email" button
    // First try with text content
    const phoneEmailButton = await page.locator(
      'div.Button_loginBtn__ImwTi:has-text("Log in with phone/email")',
    );

    if ((await phoneEmailButton.count()) > 0) {
      log.info('Clicking "Log in with phone/email" button');
      await phoneEmailButton.click();
      log.info('Successfully clicked "Log in with phone/email" button');
      // await page.waitForTimeout(2000);
    } else {
      // Try alternative selector with image alt text
      const altPhoneEmailButton = await page
        .locator('div.Button_loginBtn__ImwTi img[alt="Phone/Email Login"]')
        .first();

      if ((await altPhoneEmailButton.count()) > 0) {
        log.info(
          'Clicking "Log in with phone/email" button (using image selector)',
        );
        // Click the parent div of the image
        await altPhoneEmailButton.locator('..').click();
        log.info('Successfully clicked "Log in with phone/email" button');
        // await page.waitForTimeout(2000);
      } else {
        // Try one more selector based on the structure
        const lastLoginButton = await page
          .locator(
            'div.LoginSelection_loginSelection__PL6fP div.Button_loginBtn__ImwTi',
          )
          .last();

        if ((await lastLoginButton.count()) > 0) {
          log.info("Clicking last login button (assuming it's phone/email)");
          await lastLoginButton.click();
          log.info(
            'Successfully clicked what should be the phone/email login button',
          );
          // await page.waitForTimeout(2000);
        } else {
          log.warning('Could not find "Log in with phone/email" button');
        }
      }
    }
  } catch (error: unknown) {
    // Take a screenshot to help debug
    await page.screenshot({
      path: 'storage/screenshots/phone-email-login-error.png',
    });
    log.error('Error selecting phone/email login:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
