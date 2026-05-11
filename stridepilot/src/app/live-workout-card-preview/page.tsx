import { LiveWorkoutCardPreview } from "../components/LiveWorkoutCardPreview";
import styles from "./page.module.css";

export default function LiveWorkoutCardPreviewPage() {
  return (
    <main className={styles.previewPage}>
      <LiveWorkoutCardPreview />
    </main>
  );
}
