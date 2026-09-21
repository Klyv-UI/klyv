/**
 * The changelog, as data.
 *
 * Every released entry below is a commit that exists in this repository's
 * history — the hash is kept on each change so it can be checked — and the
 * version is the one package.json carries. Nothing is back-filled: the project
 * has shipped one version, so there is one release, plus the unreleased work
 * on the current branch, which is marked as such everywhere it is shown.
 *
 * Adding a release is one object at the top of `releases`.
 */
export type ChangeCategory = 'feature' | 'improvement' | 'fix' | 'breaking' | 'docs'

export const CHANGE_CATEGORIES: { id: ChangeCategory; label: string }[] = [
  { id: 'feature', label: 'New' },
  { id: 'improvement', label: 'Improved' },
  { id: 'fix', label: 'Fixed' },
  { id: 'breaking', label: 'Breaking' },
  { id: 'docs', label: 'Docs' },
]

export interface ChangeLink {
  label: string
  /** A route on this site. */
  to: string
}

export interface Change {
  category: ChangeCategory
  title: string
  description?: string
  /** The commit it shipped in, when there is one. */
  commit?: string
  /** What it touched, so a reader can go and look. */
  links?: ChangeLink[]
}

export interface Release {
  /** "1.0.0", or "unreleased". Also the URL segment. */
  version: string
  /** ISO date. Absent for unreleased work. */
  date?: string
  title: string
  summary: string
  status: 'released' | 'unreleased'
  changes: Change[]
}

export const releases: Release[] = [
  {
    version: 'unreleased',
    title: 'The platform',
    summary:
      'Work on the current branch, not yet in a published version: the library grows from a catalogue into a place to discover, compose, save and integrate.',
    status: 'unreleased',
    changes: [
      {
        category: 'feature',
        title: 'Ten showpieces, with a tag of their own',
        description:
          'FluidCanvas, ReactionDiffusion, ClothPanel, ShatterDismiss, ChladniPlate, LightCaster, RainGlass, PopUpCard, ParallaxPortal and InfiniteZoom: real fluid, cloth with working buttons on it, shattering glass, sand finding the nodal lines, cast shadows, refracting rain, pop-up folds, a window into a room, and a zoom that never ends. They are tagged Showpiece rather than New, so the tag stays true after the next release.',
        links: [{ label: 'Showpieces', to: '/components?showpiece=1' }],
      },
      {
        category: 'feature',
        title: 'Seventy more components, each a mechanic the library lacked, now the ones marked New',
        description:
          'Proposed with their core mechanic checked against the source, then independently reviewed: 47 of 110 candidates were rejected as duplicates, variants, compositions or too thin. MessageFormat, JustifiedText, TabCoordinator, UrlState, DraftRecovery, FuzzyFinder, FullTextSearch, QueryBar, DockLayout, PairwiseRanker, GeoCoordinateInput, CronEditor, RegexTester, CsvImport, JsonDiff, JsonQuery, AnsiOutput, CurlConverter, SemverRange, CspEvaluator, PathEditor, ImageAdjust, SmartCrop, DocumentScanner, PaletteExtractor, ModelViewer, ExifViewer, ZipBrowser, GifRecorder, MeasureTool, TimeSeriesExplorer, ForecastChart, ControlChart, KaplanMeierChart, TraceWaterfall, ContourPlot, ViolinPlot, HexbinChart, FlameGraph, ErrorBudget, FlowDiagram, Dendrogram, MindMap, ResourceScheduler, TournamentBracket, SlaTimer, TransformBox, SnapGuides, StrokeGestures, RankedChoiceResults, CommentAnchors, CollaborativeText, PeerLink, SlideDeck, ThreeWayMerge, Redactor, ReadabilityMeter, ExpenseSplitter, SqlBuilder, JwtInspector, LogPatterns, RecordMerge, SpacedRepetition, Equalizer, LoudnessMeter, BpmDetector, ChessBoard, Game2048, WordGuess and Solitaire. The previous seventy are no longer tagged New.',
        links: [{ label: 'New components', to: '/components?new=1' }],
      },
      {
        category: 'improvement',
        title: 'Four duplicate pairs merged, and ScrollProgress hands back-to-top to BackToTop',
        description:
          'UptimeBar is now StatusStrip: intervals take a declared status, incidents, downtime minutes and a date as well as a measured uptime, and the strip gains an uptime override, a legend and a one-tab-stop arrow-key cursor. SpeedDial is now RadialMenu with layout="stack", direction, labels and defaultOpen, and both layouts share the menu-button keyboard model. ScrollList is now ScrollArea with scrollbar="hidden", and AnnouncementBar is now Banner with layout="strip", badge, href and a storageKey that remembers dismissal; ScrollList and AnnouncementBar shipped in 1.0, so both stay as deprecated wrappers. ScrollProgress backToTop is deprecated and renders BackToTop with showProgress, so it moves focus, respects reduced motion and hides properly.',
        links: [
          { label: 'StatusStrip', to: '/components/status-strip' },
          { label: 'RadialMenu', to: '/components/radial-menu' },
          { label: 'ScrollArea', to: '/components/scroll-area' },
          { label: 'Banner', to: '/components/banner' },
        ],
      },
      {
        category: 'feature',
        title: 'Seventy components with mechanics the library did not have',
        description:
          'Each was checked against the whole catalogue first: none duplicates, varies or can be assembled from an existing component. ErrorBoundary, Hotkeys, LazyMount, MiddleTruncate, VisionSimulator, SpatialNavigation, FitText, Sidenotes, ScrollSync, FindInPage, RichTextEditor, SchemaForm, InlineCompletion, FormulaEditor, EasingEditor, NaturalDateInput, ProductVariantPicker, SeatMap, PatternLock, TrackChanges, CameraCapture, VoiceRecorder, CaptionEditor, DictationButton, ReadAloud, PitchTuner, AudioTrimmer, PanoramaViewer, Magnifier, BlurHashImage, ChordDiagram, SequenceDiagram, ParallelCoordinates, VennDiagram, WordCloud, ClickHeatmap, ChoroplethMap, CommitGraph, PivotTable, ImageDiff, HexViewer, OpenApiReference, StackTrace, WebVitals, A11yInspector, EmailViewer, DataProfile, ExperimentResults, AccessExplainer, PasskeyManager, NodeEditor, Whiteboard, Joystick, SortableTree, RemoteSelections, CallGrid, PictureInPicture, ScrollSequence, ShaderCanvas, VoronoiField, FractalExplorer, Sudoku, Minesweeper, SlidingPuzzle, Crossword, SnakeGame, MathFormula, TimezonePlanner, PermissionPrompt and PagedDocument.',
      },
      {
        category: 'feature',
        title: 'Seventy more components across every group',
        description:
          'Grid, TextLink, LiveRegion, HighlightMatch, Sticky, MasterDetail, DashboardGrid, ShowMoreList, NavigationProgress, PriorityNav, ScopedSearch, AlphabetIndex, RecentItems, SocialLoginButtons, UnsavedChangesBar, VoteButtons, FollowButton, AddToCalendar, WeekdayPicker, UnitInput, TimeRangePicker, RecurrenceEditor, LikertScale, CodeEditor, SearchableCheckboxList, KpiStrip, TrendDelta, WeekView, Receipt, LogViewer, TranscriptView, SunburstChart, NetworkGraph, OrgChart, BeeswarmChart, CohortRetention, StreamGraph, SignalStrength, Meteors, AnimatedGrid, UpdateAvailable, MaintenanceNotice, NotFoundState, AccessDeniedState, FullscreenDialog, FeatureBeacon, ChecklistPopover, LinkPreview, FloatingPanel, SwipeToConfirm, CircularText, MorphingText, AttentionShake, ScrollStory, SharePermissions, VersionHistory, QuestionQueue, DropOverlay, FlowField, Metronome, SpinWheel, TicTacToe, FaqSection, NewsletterSignup, UsagePricingCalculator, EmailVerification, OAuthConsent, IpAllowlist, BrandingSettings and RoadmapBoard.',
      },
      {
        category: 'feature',
        title: 'Fifty more components',
        description:
          'Stack, Container, InfiniteScroll, LanguageSwitcher, VersionSwitcher, ArticlePager, DownloadButton, LikeButton, SelectionToolbar, DateTimePicker, DurationInput, AddressInput, TreeSelect, CascadeSelect, ColorSwatchPicker, MarkdownEditor, AvatarUpload, RepeaterField, EventCalendar, AgendaList, TreeTable, EditableTable, Leaderboard, CodeTabs, VideoPlayer, AudioPlayer, GanttChart, MatrixHeatmap, RadialBarChart, SlopeChart, ParetoChart, DumbbellChart, StepLoader, UploadQueue, KeyboardShortcutsDialog, PromptDialog, ReleaseNotesModal, AnimatedList, MarkerHighlight, ShimmerText, ImageAnnotator, ResizableBox, GameOfLife, MemoryGame, SeatSelector, CancellationFlow, DataExportPanel, AccessRequests, DomainSetup and LocaleSettings.',
      },
      {
        category: 'feature',
        title: 'Forty more components',
        description:
          'AspectRatio, ScrollArea, Masonry, Menubar, MegaMenu, BackToTop, ToggleButton, ShareMenu, PhoneInput, CreditCardInput, ChoiceCardGroup, TransferList, MonthPicker, TimeSlotPicker, InputGroup, EmojiPicker, ProfileCard, FileList, ReviewSummary, ProductCard, OrderTracker, ImageGallery, ScatterChart, WaterfallChart, Histogram, BoxPlot, BulletChart, CandlestickChart, IncidentTimeline, ConfirmPopover, Toggletip, ChatThread, MessageComposer, CommentThread, NotificationPreferences, FeatureFlags, ReferralCard and NpsSurvey.',
      },
      {
        category: 'feature',
        title: 'Composer',
        description:
          'Build a screen from the real components and blocks on a canvas, edit their props, preview it at three widths and copy the code with its dependencies.',
        links: [{ label: 'Composer', to: '/composer' }],
      },
      {
        category: 'feature',
        title: 'Smart search',
        description:
          'The ⌘K palette now ranks fuzzy matches across components, blocks, templates, recipes, integrations, tokens and releases, and remembers recent searches and pages.',
      },
      {
        category: 'feature',
        title: 'Favorites and collections',
        description: 'Save any component, block, template, recipe or integration, and file it into collections.',
        links: [{ label: 'Saved', to: '/saved' }],
      },
      {
        category: 'feature',
        title: 'Component health',
        description:
          'Every component page shows its status and only the capabilities there is evidence for — measured from the source and the test suites, not typed by hand.',
      },
      {
        category: 'feature',
        title: 'Find My UI',
        description: 'Answer two questions and get components, blocks, templates and recipes chosen from the shared tags.',
        links: [{ label: 'Find My UI', to: '/find' }],
      },
      {
        category: 'feature',
        title: 'Templates, recipes, integrations and Built With',
        links: [
          { label: 'Templates', to: '/templates' },
          { label: 'Recipes', to: '/recipes' },
          { label: 'Integrations', to: '/integrations' },
          { label: 'Built With', to: '/built-with' },
        ],
      },
      {
        category: 'improvement',
        title: 'CommandPalette takes a custom filter, a loading state and a description per command',
        description: 'All optional; existing callers behave exactly as before.',
        links: [{ label: 'CommandPalette', to: '/components/command-palette' }],
      },
      {
        category: 'improvement',
        title: 'The sidebar groups its links by what you came to do',
        description: 'Explore, Build, Design system, Developer and Saved — the component index below is unchanged.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-11',
    title: 'Klyv 1.0',
    summary:
      'The first version: an accent-led component library, the blocks built from it, an MCP server and an Agent Skill, and a docs site built with the library it documents.',
    status: 'released',
    changes: [
      {
        category: 'feature',
        title: 'A SaaS group of 42 components, three SaaS blocks, and a New tag',
        commit: 'e9ccffc',
        links: [
          { label: 'SaaS components', to: '/components?group=saas' },
          { label: 'SaaS landing', to: '/blocks/saas-landing' },
          { label: 'SaaS dashboard', to: '/blocks/saas-dashboard' },
          { label: 'SaaS admin', to: '/blocks/saas-admin' },
        ],
      },
      {
        category: 'feature',
        title: 'Blocks reach the CLI, the MCP server and search',
        commit: '57ce183',
        links: [{ label: 'Blocks', to: '/blocks' }],
      },
      {
        category: 'feature',
        title: 'Sixteen new components, and a landing page that leads with useful ones',
        commit: '183b121',
        links: [{ label: 'Components', to: '/components' }],
      },
      {
        category: 'feature',
        title: 'Button renders as a link with `as`',
        commit: '6964bd4',
        links: [{ label: 'Button', to: '/components/button' }],
      },
      {
        category: 'feature',
        title: 'Blocks — seven production-ready screens',
        commit: '150aeb2',
        links: [{ label: 'Blocks', to: '/blocks' }],
      },
      {
        category: 'feature',
        title: 'The library, exposed to AI harnesses over MCP and as an Agent Skill',
        commit: '787f941',
        links: [{ label: 'AI agents', to: '/agents' }],
      },
      {
        category: 'feature',
        title: 'Klyv, an accent-led React component library',
        commit: 'e68c49b',
        links: [{ label: 'Get started', to: '/getting-started' }],
      },
      {
        category: 'improvement',
        title: 'Keyboard behaviour the docs promise is now covered by tests',
        commit: '917d357',
      },
      {
        category: 'improvement',
        title: 'The landing page, redesigned around components, blocks and screens',
        commit: 'e0a81ff',
        links: [{ label: 'Overview', to: '/' }],
      },
      {
        category: 'improvement',
        title: 'The sidebar stopped re-rendering on navigation, and every example is framed alike',
        commit: 'afce8ec',
      },
      {
        category: 'improvement',
        title: 'Sidebar links for the new pages, and both component views reworked',
        commit: '6a2e821',
        links: [{ label: 'Components', to: '/components' }],
      },
      {
        category: 'fix',
        title: 'Colour contrast, measured in a real browser',
        commit: 'f1d3163',
        links: [{ label: 'Foundations', to: '/foundations' }],
      },
      {
        category: 'docs',
        title: 'The README contradicted itself about the dependency count',
        commit: '785f8b2',
      },
      {
        category: 'docs',
        title: 'The 21 props the new components left blank are described',
        commit: '6a35a58',
      },
      {
        category: 'docs',
        title: 'A Get started page',
        commit: 'b87f645',
        links: [{ label: 'Get started', to: '/getting-started' }],
      },
      {
        category: 'docs',
        title: 'The MCP server and the skill documented on the site',
        commit: '5a03193',
        links: [{ label: 'AI agents', to: '/agents' }],
      },
    ],
  },
]

export function findRelease(version: string | undefined): Release | undefined {
  return releases.find((release) => release.version === version)
}

export function releaseLabel(release: Release): string {
  return release.status === 'unreleased' ? 'Unreleased' : `v${release.version}`
}
