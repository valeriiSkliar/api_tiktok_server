/**
 * Captcha detection result model
 * Contains information about a detected captcha
 */
export interface CaptchaDetectionResult {
  /**
   * Whether a captcha was detected
   */
  detected: boolean;
  
  /**
   * CSS selector for the captcha element if detected
   */
  selector?: string;
  
  /**
   * Path to a screenshot of the captcha if taken
   */
  screenshotPath?: string;
}
