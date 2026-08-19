import { memo } from "react";
import { ScrollView } from "react-native";
import { styles } from "../styles";
import { getJournalStats } from "../core";
import { HeroBanner } from "../components/HeroBanner";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { JournalCard } from "../components/JournalCard";
import { JournalPromptCard } from "../components/JournalPromptCard";
import { JournalInsightsCard } from "../components/JournalInsightsCard";
import { JournalMemoriesCard } from "../components/JournalMemoriesCard";
import { PhotoGalleryCard } from "../components/PhotoGalleryCard";
import { AdaptiveColumns } from "../components/AdaptiveColumns";
import { useScrollToTop } from "../lib/scrollToTop";

// The Tank Journal, on its own tab — a dated log of milestones, arrivals, and
// problems (with photos and a mood), plus the insight and memory cards built on
// top of those entries, and a photo gallery of everything shot.
export const JournalTab = memo(function JournalTab({ journal = [], onAddJournal, onDeleteJournal, onEditJournal }) {
  const scrollRef = useScrollToTop();
  const photoCount = journal.filter((e) => e.photo).length;
  const stats = getJournalStats(journal);

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AdaptiveColumns lead={1}>
      <HeroBanner
        eyebrow={journal.length ? `${journal.length} ${journal.length === 1 ? "entry" : "entries"}` : "Your tank's story"}
        title="Journal"
        subtitle="Log milestones, new arrivals, and anything you spot — with a photo and a mood."
        emoji="📓"
        colors={["#123a4e", "#0c2c40", "#071d2e"]}
      />

      {/* Only appears when the log is empty or has gone quiet for a week. */}
      <JournalPromptCard daysSinceLast={stats.daysSinceLast} />

      <CollapsibleCard storageKey="journal" title="📓 Tank Journal" defaultOpen={true}>
        <JournalCard entries={journal} onAdd={onAddJournal} onDelete={onDeleteJournal} onEdit={onEditJournal} />
      </CollapsibleCard>

      <CollapsibleCard
        storageKey="journalinsights"
        title="📈 Journal Insights"
        eyebrow={stats.streak ? `${stats.streak}-day streak` : `${stats.total} logged`}
        defaultOpen={stats.total > 0}
      >
        <JournalInsightsCard journal={journal} />
      </CollapsibleCard>

      <CollapsibleCard storageKey="journalmemories" title="🕰️ Looking Back" eyebrow="On this day · Milestones · Compare">
        <JournalMemoriesCard journal={journal} />
      </CollapsibleCard>

      {photoCount ? (
        <CollapsibleCard storageKey="gallery" title="🖼️ Photo Gallery" eyebrow={`${photoCount} ${photoCount === 1 ? "photo" : "photos"}`}>
          <PhotoGalleryCard journal={journal} />
        </CollapsibleCard>
      ) : null}
    </AdaptiveColumns>
    </ScrollView>
  );
})
