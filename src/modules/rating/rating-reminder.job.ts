import schedule from "node-schedule";
import { processRatingReminders } from "./rating.service";

/**
 * Scheduled job that runs once a day at 00:01 AM
 * to check for handovers that need rating reminders.
 * Catatan: saat ini belum dijalankan oleh server.ts.
 */
export function startRatingReminderJob() {
  const job = schedule.scheduleJob("1 0 * * *", async () => {
    console.log(`🕒 [${new Date().toISOString()}] Running daily rating reminder job`);

    try {
      await processRatingReminders();
      console.log(`✅ [${new Date().toISOString()}] Rating reminder job completed successfully`);
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Error running rating reminder job:`, error);
    }
  });

  console.log("📅 Daily rating reminder scheduled job started (00:01 AM)");
  return job;
}

// Run this job when the file is directly executed (for testing)
if (require.main === module) {
  console.log("🧪 Starting rating reminder job in test mode");
  startRatingReminderJob();

  processRatingReminders()
    .then(() => console.log("✅ Test run completed"))
    .catch((err: unknown) => console.error("❌ Test run failed:", err));
}
