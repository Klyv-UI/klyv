import type { GroupId } from './groups'

/**
 * Every component in the library, with the group and section it is filed
 * under in the docs.
 *
 * This file is the single source of truth for navigation, search and the
 * catalogue counts. Adding a component is one row here plus its examples.
 */
export interface CatalogEntry {
  /** Exported name, and the folder it lives in under `src/components`. */
  name: string
  /** URL segment under /components. */
  slug: string
  group: GroupId
  /** Sub-heading within the group, in the sidebar and on the group page. */
  section: string
  /** One line, shown in listings and under the title. */
  blurb: string
}

export const catalog: CatalogEntry[] = [
  // Foundations / Primitives
  { name: 'Divider', slug: 'divider', group: 'Foundations', section: 'Primitives', blurb: 'A rule on the line token, so the one place needing it does not hard-code a colour.' },
  { name: 'Surface', slug: 'surface', group: 'Foundations', section: 'Primitives', blurb: 'The five container recipes - card, tile, field, sunken, floating - instead of a drifting radius/border/shadow class string.' },
  { name: 'Text', slug: 'text', group: 'Foundations', section: 'Primitives', blurb: 'The whole type scale as one component. Without it every screen re-types the sizes by hand, which is where drift starts.' },
  { name: 'Wordmark', slug: 'wordmark', group: 'Foundations', section: 'Primitives', blurb: 'Mark plus name lockup; the mark itself is a slot.' },
  // Foundations / Utilities
  { name: 'FocusTrap', slug: 'focus-trap', group: 'Foundations', section: 'Utilities', blurb: 'Focus containment and restore, written once. Every dialog, drawer and menu in the library shares it.' },
  { name: 'Portal', slug: 'portal', group: 'Foundations', section: 'Utilities', blurb: 'Renders into a node outside the current tree. Modal, Drawer, Toast, Popover and ContextMenu all need it.' },
  { name: 'Presence', slug: 'presence', group: 'Foundations', section: 'Utilities', blurb: 'Keeps a node mounted long enough to animate out, and owns the timers so its callers do not have to.' },
  { name: 'SkipLink', slug: 'skip-link', group: 'Foundations', section: 'Utilities', blurb: 'Hidden until focused; depends only on the focus tokens.' },
  { name: 'VisuallyHidden', slug: 'visually-hidden', group: 'Foundations', section: 'Utilities', blurb: 'Text for screen readers only. Every icon-only control needs one.' },
  // Layout / Structure
  { name: 'AppShell', slug: 'app-shell', group: 'Layout', section: 'Structure', blurb: 'The floating rounded window on a tinted canvas; full-bleed below xl.' },
  { name: 'BentoGrid', slug: 'bento-grid', group: 'Layout', section: 'Structure', blurb: 'The mixed-span card grid the overview page lays out.' },
  { name: 'Card', slug: 'card', group: 'Layout', section: 'Structure', blurb: 'A titled container with an optional action and a body slot - the shape most content ends up in.' },
  { name: 'PageHeader', slug: 'page-header', group: 'Layout', section: 'Structure', blurb: 'Title block with actions, for secondary routes.' },
  { name: 'PromoBanner', slug: 'promo-banner', group: 'Layout', section: 'Structure', blurb: 'A hero strip: headline, highlighted phrase, supporting link, call to action, and a slot for artwork.' },
  { name: 'SplitPane', slug: 'split-pane', group: 'Layout', section: 'Structure', blurb: 'Two panes and a divider that moves by pointer or arrow key, announced as a splitter with its position.' },
  { name: 'AspectRatio', slug: 'aspect-ratio', group: 'Layout', section: 'Structure', blurb: 'Holds a box to a ratio before its media loads, with CSS aspect-ratio and object-cover, so thumbnail grids never jump as images arrive.' },
  { name: 'Stack', slug: 'stack', group: 'Layout', section: 'Structure', blurb: 'Flex row or column with gaps on the spacing scale, direction that can change per breakpoint, and dividers that sit centred in the gap and turn with it.' },
  { name: 'Container', slug: 'container', group: 'Layout', section: 'Structure', blurb: 'The centred page column: width presets from the site shell and its own gutters, so pages line up with the header. ContainerBleed runs a child to the edge.' },
  // Layout / Disclosure
  { name: 'Accordion', slug: 'accordion', group: 'Layout', section: 'Disclosure', blurb: 'A set of Collapsibles with single- or multi-open policy.' },
  { name: 'Collapse', slug: 'collapse', group: 'Layout', section: 'Disclosure', blurb: 'Height transition primitive for disclosure.' },
  { name: 'Collapsible', slug: 'collapsible', group: 'Layout', section: 'Disclosure', blurb: 'Collapse + a trigger.' },
  { name: 'ExpandableText', slug: 'expandable-text', group: 'Layout', section: 'Disclosure', blurb: 'Clamps long text to a few lines, and only offers to show more when there is more to show.' },
  // Layout / Stacks & scrolling
  { name: 'CardDeck', slug: 'card-deck', group: 'Layout', section: 'Stacks & scrolling', blurb: 'The equal-height card band.' },
  { name: 'Carousel', slug: 'carousel', group: 'Layout', section: 'Stacks & scrolling', blurb: 'Scroll-snap track + chevrons; the card band below xl.' },
  { name: 'CoverFlow', slug: 'cover-flow', group: 'Layout', section: 'Stacks & scrolling', blurb: 'A carousel with depth. One transform per card from its signed distance, with stacking order taken from the absolute one.' },
  { name: 'CubeCarousel', slug: 'cube-carousel', group: 'Layout', section: 'Stacks & scrolling', blurb: 'Four faces on one cube. The whole cube turns, so the corners never come apart, and the rotation accumulates.' },
  { name: 'LayerStack', slug: 'layer-stack', group: 'Layout', section: 'Stacks & scrolling', blurb: 'An exploded isometric stack. Two rotations on a shared parent, so the plates stay coplanar and every label is real text.' },
  { name: 'Marquee', slug: 'marquee', group: 'Layout', section: 'Stacks & scrolling', blurb: 'Looping horizontal scroller.' },
  { name: 'ScrollList', slug: 'scroll-list', group: 'Layout', section: 'Stacks & scrolling', blurb: 'A scrolling list with masked edges, so a cut-off row fades instead of ending mid-pixel.' },
  { name: 'StackedCards', slug: 'stacked-cards', group: 'Layout', section: 'Stacks & scrolling', blurb: 'Cards that stick and pile up as you scroll. CSS does the stacking; one measurement a frame supplies the depth.' },
  { name: 'ScrollArea', slug: 'scroll-area', group: 'Layout', section: 'Stacks & scrolling', blurb: 'A named, focusable scroll region with thin scrollbars and edges that fade only while there is more content past them, on either axis or both.' },
  { name: 'Masonry', slug: 'masonry', group: 'Layout', section: 'Stacks & scrolling', blurb: 'Tiles of mixed height packed into columns set by its own width, kept in source order so what you see matches the reading and tab order.' },
  { name: 'InfiniteScroll', slug: 'infinite-scroll', group: 'Layout', section: 'Stacks & scrolling', blurb: 'Loads more as the end comes into view, with a real Load more button as the fallback, the new count announced, and a retry when loading fails.' },
  // Navigation / Bars & shells
  { name: 'Dock', slug: 'dock', group: 'Navigation', section: 'Bars & shells', blurb: 'Tiles that swell towards the pointer as one curve, measured from the wrapper so the growth never feeds back into itself.' },
  { name: 'Navbar', slug: 'navbar', group: 'Navigation', section: 'Bars & shells', blurb: 'The application header: brand, primary navigation, tools and an account control.' },
  { name: 'Sidebar', slug: 'sidebar', group: 'Navigation', section: 'Bars & shells', blurb: 'Full-width navigation column with grouped sections.' },
  { name: 'SidebarRail', slug: 'sidebar-rail', group: 'Navigation', section: 'Bars & shells', blurb: 'The 42px icon rail with a pinned footer group.' },
  { name: 'Toolbar', slug: 'toolbar', group: 'Navigation', section: 'Bars & shells', blurb: 'Surface + IconButton cluster. The header utility group.' },
  { name: 'BackToTop', slug: 'back-to-top', group: 'Navigation', section: 'Bars & shells', blurb: 'A floating button that appears past a threshold, returns to the top instantly under reduced motion, moves focus there, and can show a progress ring.' },
  // Navigation / Tabs & steps
  { name: 'AnchorNav', slug: 'anchor-nav', group: 'Navigation', section: 'Tabs & steps', blurb: 'In-page link list with scroll-spy.' },
  { name: 'BackButton', slug: 'back-button', group: 'Navigation', section: 'Tabs & steps', blurb: 'IconButton + Text, wired to history.' },
  { name: 'Breadcrumb', slug: 'breadcrumb', group: 'Navigation', section: 'Tabs & steps', blurb: 'Text + Divider trail with an overflow rule.' },
  { name: 'MagicTabs', slug: 'magic-tabs', group: 'Navigation', section: 'Tabs & steps', blurb: 'Tabs whose indicator measures and slides between them. SegmentedControl cross-fades a background; this one travels.' },
  { name: 'Pagination', slug: 'pagination', group: 'Navigation', section: 'Tabs & steps', blurb: 'ButtonGroup + IconButton with a page-window algorithm.' },
  { name: 'Stepper', slug: 'stepper', group: 'Navigation', section: 'Tabs & steps', blurb: 'Numbered progress through a flow; StatusDot + Text + Divider.' },
  { name: 'TabBar', slug: 'tab-bar', group: 'Navigation', section: 'Tabs & steps', blurb: 'Tabs laid out for a bottom bar.' },
  { name: 'Tabs', slug: 'tabs', group: 'Navigation', section: 'Tabs & steps', blurb: 'SegmentedControl + panels with correct tab semantics.' },
  { name: 'ArticlePager', slug: 'article-pager', group: 'Navigation', section: 'Tabs & steps', blurb: 'Previous and next links with direction labels and titles, in a named nav. A lone link keeps its own side.' },
  // Navigation / Menus & search
  { name: 'CommandPalette', slug: 'command-palette', group: 'Navigation', section: 'Menus & search', blurb: 'Modal + Combobox + Kbd over a command registry.' },
  { name: 'ContextMenu', slug: 'context-menu', group: 'Navigation', section: 'Menus & search', blurb: 'Menu opened at the pointer, via Portal.' },
  { name: 'DropdownMenu', slug: 'dropdown-menu', group: 'Navigation', section: 'Menus & search', blurb: 'Menu with a trigger and keyboard navigation.' },
  { name: 'Menu', slug: 'menu', group: 'Navigation', section: 'Menus & search', blurb: 'Surface(floating) + Button; owns open state, outside-click and Escape.' },
  { name: 'RadialMenu', slug: 'radial-menu', group: 'Navigation', section: 'Menus & search', blurb: 'Actions fanned on an arc, where every item is the same distance from the pointer. A vertical menu always favours its first item.' },
  { name: 'Menubar', slug: 'menubar', group: 'Navigation', section: 'Menus & search', blurb: 'A File / Edit / View bar that follows the WAI-ARIA menubar pattern: one tab stop, arrow keys across and down, submenus, checkable items, Escape returns focus.' },
  { name: 'MegaMenu', slug: 'mega-menu', group: 'Navigation', section: 'Menus & search', blurb: 'Site navigation that opens wide panels of grouped, described links, built as a disclosure with hover intent, one panel at a time and Escape to close.' },
  { name: 'LanguageSwitcher', slug: 'language-switcher', group: 'Navigation', section: 'Menus & search', blurb: 'Languages in their own words with English second, a lang attribute on each, a globe trigger and a filter once the list gets long.' },
  { name: 'VersionSwitcher', slug: 'version-switcher', group: 'Navigation', section: 'Menus & search', blurb: 'Docs version picker with Latest, Pre-release and Deprecated tags, plus a notice on old pages that links to the latest version.' },
  // Actions / Buttons
  { name: 'Button', slug: 'button', group: 'Actions', section: 'Buttons', blurb: 'A native button plus token classes.' },
  { name: 'ButtonGroup', slug: 'button-group', group: 'Actions', section: 'Buttons', blurb: 'Segmented Buttons sharing one border and roving focus.' },
  { name: 'CopyButton', slug: 'copy-button', group: 'Actions', section: 'Buttons', blurb: 'Puts a value on the clipboard and announces it - a glyph turning into a tick tells a screen reader nothing.' },
  { name: 'IconButton', slug: 'icon-button', group: 'Actions', section: 'Buttons', blurb: 'Glyph-only button; the label is non-visual, so it is required.' },
  { name: 'SegmentedControl', slug: 'segmented-control', group: 'Actions', section: 'Buttons', blurb: 'The nav pill track — a single-select ButtonGroup.' },
  { name: 'ToggleGroup', slug: 'toggle-group', group: 'Actions', section: 'Buttons', blurb: 'On/off toggles in a row, each a real aria-pressed button. Unlike SegmentedControl, having none pressed is allowed.' },
  { name: 'ToggleButton', slug: 'toggle-button', group: 'Actions', section: 'Buttons', blurb: 'A single button that stays pressed, announced with aria-pressed, with Button’s variants and sizes, an optional icon swap and a label that never flips.' },
  { name: 'DownloadButton', slug: 'download-button', group: 'Actions', section: 'Buttons', blurb: 'One button from idle to progress ring, done and retry, with a cancel control, the file size in the label and each state change announced.' },
  { name: 'LikeButton', slug: 'like-button', group: 'Actions', section: 'Buttons', blurb: 'Toggle heart that updates at once and rolls back if saving fails. The count shows as 1.2k but is read out in full; no burst under reduced motion.' },
  // Actions / Composed
  { name: 'HoldToConfirm', slug: 'hold-to-confirm', group: 'Actions', section: 'Composed', blurb: 'A destructive action held rather than clicked. Spread commitment beats a dialog dismissed by reflex.' },
  { name: 'MagneticButton', slug: 'magnetic-button', group: 'Actions', section: 'Composed', blurb: 'Button that tracks the pointer.' },
  { name: 'QuickActions', slug: 'quick-actions', group: 'Actions', section: 'Composed', blurb: 'The icon-over-label action row from the balance card, with optional keyboard shortcuts shown on the controls rather than hidden in a help page.' },
  { name: 'ShimmerButton', slug: 'shimmer-button', group: 'Actions', section: 'Composed', blurb: 'A call to action with a sheen sweeping across it and a light that follows the pointer, written to CSS variables rather than to state.' },
  { name: 'SplitButton', slug: 'split-button', group: 'Actions', section: 'Composed', blurb: 'A primary action with its alternatives beside it - two buttons with two names, not one button with a hot zone.' },
  { name: 'SpeedDial', slug: 'speed-dial', group: 'Actions', section: 'Composed', blurb: 'A floating action button that opens into labelled secondary actions, with menu-button keyboard support, four directions, and labels shown or on hover.' },
  { name: 'ShareMenu', slug: 'share-menu', group: 'Actions', section: 'Composed', blurb: 'Hands off to navigator.share where it exists, otherwise a menu with copy link (confirmed in words) plus email, X, LinkedIn and Facebook links.' },
  { name: 'SelectionToolbar', slug: 'selection-toolbar', group: 'Actions', section: 'Composed', blurb: 'A toolbar that floats above selected text; Alt+F10 moves focus into it, arrows move between buttons, and Escape returns focus.' },
  // Forms & Inputs / Text fields
  { name: 'InlineEdit', slug: 'inline-edit', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Text that becomes a field on request: Enter saves, Escape restores, and focus returns to where it was.' },
  { name: 'Input', slug: 'input', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Wraps a native input; no label or validation opinions.' },
  { name: 'InputOTP', slug: 'input-otp', group: 'Forms & Inputs', section: 'Text fields', blurb: 'A row of single-character Inputs with paste and focus movement.' },
  { name: 'MentionInput', slug: 'mention-input', group: 'Forms & Inputs', section: 'Text fields', blurb: 'An @-mention list positioned at the caret, measured through a hidden mirror of the textarea.' },
  { name: 'PasswordInput', slug: 'password-input', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Input + reveal IconButton.' },
  { name: 'PasswordStrength', slug: 'password-strength', group: 'Forms & Inputs', section: 'Text fields', blurb: 'A Meter and a rule checklist that say, in words, what would make a password stronger.' },
  { name: 'PinPad', slug: 'pin-pad', group: 'Forms & Inputs', section: 'Text fields', blurb: 'A keypad and the physical keyboard as one control, where rejection is the return value rather than a ref reaching in.' },
  { name: 'SearchField', slug: 'search-field', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Input + icon adornment + clear affordance. The header search.' },
  { name: 'TagInput', slug: 'tag-input', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Input + Chip list.' },
  { name: 'Textarea', slug: 'textarea', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Multi-line sibling of Input, sharing its chrome.' },
  { name: 'PhoneInput', slug: 'phone-input', group: 'Forms & Inputs', section: 'Text fields', blurb: 'Dial-code select joined to a national number that formats as you type, stored as one E.164 string, with a small overridable country list.' },
  { name: 'AddressInput', slug: 'address-input', group: 'Forms & Inputs', section: 'Text fields', blurb: 'A postal address as autofill-ready parts, relabelled per country (State, County, ZIP code, Postcode), with an optional suggestions slot for your provider.' },
  // Forms & Inputs / Choice
  { name: 'Checkbox', slug: 'checkbox', group: 'Forms & Inputs', section: 'Choice', blurb: 'Native input with a drawn box; no layout or label of its own.' },
  { name: 'CheckboxGroup', slug: 'checkbox-group', group: 'Forms & Inputs', section: 'Choice', blurb: 'Checkbox + Label + Field; owns the shared name and value array.' },
  { name: 'Combobox', slug: 'combobox', group: 'Forms & Inputs', section: 'Choice', blurb: 'Select + Input filtering.' },
  { name: 'MultiSelect', slug: 'multi-select', group: 'Forms & Inputs', section: 'Choice', blurb: 'Select + Chip list for the selected values.' },
  { name: 'Radio', slug: 'radio', group: 'Forms & Inputs', section: 'Choice', blurb: 'A native radio with a drawn dot. Grouping and layout belong to RadioGroup.' },
  { name: 'RadioGroup', slug: 'radio-group', group: 'Forms & Inputs', section: 'Choice', blurb: 'Radio + Label + Field; owns roving focus.' },
  { name: 'Rating', slug: 'rating', group: 'Forms & Inputs', section: 'Choice', blurb: 'A radio group drawn as stars.' },
  { name: 'Select', slug: 'select', group: 'Forms & Inputs', section: 'Choice', blurb: 'Menu + Button trigger with listbox semantics. The currency pickers.' },
  { name: 'Switch', slug: 'switch', group: 'Forms & Inputs', section: 'Choice', blurb: 'Native checkbox presented as a track and knob.' },
  { name: 'ChoiceCardGroup', slug: 'choice-card-group', group: 'Forms & Inputs', section: 'Choice', blurb: 'Radios or checkboxes drawn as cards with title, description, icon and price, on real inputs so arrow keys and forms just work.' },
  { name: 'TransferList', slug: 'transfer-list', group: 'Forms & Inputs', section: 'Choice', blurb: 'Two filterable multi-select lists with move and move-all buttons, full keyboard marking and announced counts.' },
  { name: 'TreeSelect', slug: 'tree-select', group: 'Forms & Inputs', section: 'Choice', blurb: 'Pick one or many from a hierarchy in a popover, with the tree keyboard model, a filter that opens matching branches, and tri-state parents.' },
  { name: 'CascadeSelect', slug: 'cascade-select', group: 'Forms & Inputs', section: 'Choice', blurb: 'Side-by-side columns from country to region to city in a popover; pointing or the arrow keys open the next level, and children can load on demand.' },
  { name: 'ColorSwatchPicker', slug: 'color-swatch-picker', group: 'Forms & Inputs', section: 'Choice', blurb: 'One colour from a named palette as a radio group, each swatch announced by name, with a tick that picks black or white ink for contrast.' },
  // Forms & Inputs / Numeric & range
  { name: 'AmountField', slug: 'amount-field', group: 'Forms & Inputs', section: 'Numeric & range', blurb: 'Currency symbol + bare Input + currency Select, as Exchange Money uses twice. Keeps parsing and formatting in one place.' },
  { name: 'EmojiSlider', slug: 'emoji-slider', group: 'Forms & Inputs', section: 'Numeric & range', blurb: 'A rating where the face is the readout and the word is the aria-valuetext, because the number is an implementation detail.' },
  { name: 'Knob', slug: 'knob', group: 'Forms & Inputs', section: 'Numeric & range', blurb: 'A rotary control dragged vertically, not circularly — an angular drag spikes whenever the pointer crosses the centre.' },
  { name: 'NumberInput', slug: 'number-input', group: 'Forms & Inputs', section: 'Numeric & range', blurb: 'Input + step controls; shares Slider’s clamping.' },
  { name: 'RangeSlider', slug: 'range-slider', group: 'Forms & Inputs', section: 'Numeric & range', blurb: 'Two Slider thumbs sharing one track.' },
  { name: 'Slider', slug: 'slider', group: 'Forms & Inputs', section: 'Numeric & range', blurb: 'Native range input restyled against the track tokens.' },
  // Forms & Inputs / Date & time
  { name: 'Calendar', slug: 'calendar', group: 'Forms & Inputs', section: 'Date & time', blurb: 'Month grid with keyboard date navigation.' },
  { name: 'DatePicker', slug: 'date-picker', group: 'Forms & Inputs', section: 'Date & time', blurb: 'Calendar in a Popover, wired to a Field.' },
  { name: 'DateRangePicker', slug: 'date-range-picker', group: 'Forms & Inputs', section: 'Date & time', blurb: 'DatePicker with two linked endpoints.' },
  { name: 'TimePicker', slug: 'time-picker', group: 'Forms & Inputs', section: 'Date & time', blurb: 'Time selection in a Popover.' },
  { name: 'MonthPicker', slug: 'month-picker', group: 'Forms & Inputs', section: 'Date & time', blurb: 'A 4×3 month grid with year stepper, min and max, optional range mode and calendar-style arrow keys; works inline or in a Popover.' },
  { name: 'TimeSlotPicker', slug: 'time-slot-picker', group: 'Forms & Inputs', section: 'Date & time', blurb: 'Day strip plus a grid of time slots with taken times struck through, radio semantics and the timezone always shown.' },
  { name: 'DateTimePicker', slug: 'date-time-picker', group: 'Forms & Inputs', section: 'Date & time', blurb: 'One field for a date and a time: type YYYY-MM-DD HH:mm or pick from Calendar and TimePicker, with whole-moment limits and the time zone shown.' },
  { name: 'DurationInput', slug: 'duration-input', group: 'Forms & Inputs', section: 'Date & time', blurb: 'Hours, minutes and optional seconds as spinbuttons, stored as seconds; arrows carry between units, and 1h 30m types or pastes straight in.' },
  // Forms & Inputs / Rich input
  { name: 'ColorPicker', slug: 'color-picker', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Area, hue and alpha controls in a Popover.' },
  { name: 'Cropper', slug: 'cropper', group: 'Forms & Inputs', section: 'Rich input', blurb: 'A crop frame in fractions, not pixels, so it survives a resize. One box-shadow dims everything outside it.' },
  { name: 'FileUpload', slug: 'file-upload', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Drop zone, file list and progress.' },
  { name: 'ShortcutRecorder', slug: 'shortcut-recorder', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Records the next combination pressed, swallowing every key including the ones the browser wanted.' },
  { name: 'SignaturePad', slug: 'signature-pad', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Freehand with speed-varied width, smoothed through midpoints. Strokes are points, so undo and resize both repaint.' },
  { name: 'CreditCardInput', slug: 'credit-card-input', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Card number, expiry and CVC as one control: detects brand, groups digits, checks Luhn and moves between parts as you type.' },
  { name: 'EmojiPicker', slug: 'emoji-picker', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Searchable emoji grid with category tabs and recents, a built-in set of about 200 named emoji, and grid arrow-key navigation.' },
  { name: 'MarkdownEditor', slug: 'markdown-editor', group: 'Forms & Inputs', section: 'Rich input', blurb: 'Markdown with a formatting toolbar, Ctrl or ⌘ with B, I and K, and a preview built as React elements, so raw HTML and unsafe links stay inert.' },
  { name: 'AvatarUpload', slug: 'avatar-upload', group: 'Forms & Inputs', section: 'Rich input', blurb: 'A profile photo you click or drop an image onto, with type and size checks stated in words, an optional square crop, and preview URLs revoked when replaced.' },
  // Forms & Inputs / Form structure
  { name: 'Field', slug: 'field', group: 'Forms & Inputs', section: 'Form structure', blurb: 'Label + control + hint + error, with the id wiring in one place.' },
  { name: 'FilterBar', slug: 'filter-bar', group: 'Forms & Inputs', section: 'Form structure', blurb: 'Chip and Select row with a clear-all action.' },
  { name: 'Form', slug: 'form', group: 'Forms & Inputs', section: 'Form structure', blurb: 'Field layout and submission state; no validation library baked in.' },
  { name: 'Label', slug: 'label', group: 'Forms & Inputs', section: 'Form structure', blurb: 'Form label on the type scale; owns the htmlFor association only.' },
  { name: 'ValidationSummary', slug: 'validation-summary', group: 'Forms & Inputs', section: 'Form structure', blurb: 'The digest that takes focus when a submission is rejected — the only pattern that makes an error below the fold perceivable.' },
  { name: 'InputGroup', slug: 'input-group', group: 'Forms & Inputs', section: 'Form structure', blurb: 'Joins text, icon, button or select addons to an Input with one shared border, radius and focus ring; passes Field wiring through.' },
  { name: 'RepeaterField', slug: 'repeater-field', group: 'Forms & Inputs', section: 'Form structure', blurb: 'Repeating rows of fields with add, remove and move; focus goes somewhere sensible after every change, and each change is announced.' },
  // Data Display / Identity
  { name: 'Avatar', slug: 'avatar', group: 'Data Display', section: 'Identity', blurb: 'Initials, tint and accessible name from one string.' },
  { name: 'AvatarGroup', slug: 'avatar-group', group: 'Data Display', section: 'Identity', blurb: 'Overlapping Avatars with an overflow count.' },
  { name: 'Badge', slug: 'badge', group: 'Data Display', section: 'Identity', blurb: 'Short qualifier attached to something else.' },
  { name: 'Chip', slug: 'chip', group: 'Data Display', section: 'Identity', blurb: 'Selectable or removable pill. Interactive counterpart to Tag.' },
  { name: 'IconTile', slug: 'icon-tile', group: 'Data Display', section: 'Identity', blurb: 'The rounded glyph plate at the start of a list row or a stat tile.' },
  { name: 'Kbd', slug: 'kbd', group: 'Data Display', section: 'Identity', blurb: 'A keyboard key. Pure typography and border tokens.' },
  { name: 'Tag', slug: 'tag', group: 'Data Display', section: 'Identity', blurb: 'Static outlined label. Non-interactive counterpart to Chip.' },
  { name: 'ProfileCard', slug: 'profile-card', group: 'Data Display', section: 'Identity', blurb: 'A person at a glance: cover, avatar, name as a real heading, bio, labelled stats and links, with a compact row variant for lists.' },
  // Data Display / Lists & tables
  { name: 'ActivityFeed', slug: 'activity-feed', group: 'Data Display', section: 'Lists & tables', blurb: 'A transaction feed grouped by day with sticky headers and rows that expand in place, so the reader keeps their position.' },
  { name: 'BulkActionBar', slug: 'bulk-action-bar', group: 'Data Display', section: 'Lists & tables', blurb: 'Appears once rows are selected: how many, what can be done to them, and a way out - announced as it changes.' },
  { name: 'DataExplorer', slug: 'data-explorer', group: 'Data Display', section: 'Lists & tables', blurb: 'A whole list screen — search, filters, sortable table and all four data states — wired together once.' },
  { name: 'DataTable', slug: 'data-table', group: 'Data Display', section: 'Lists & tables', blurb: 'Table + sorting, selection, pagination and column state.' },
  { name: 'DescriptionList', slug: 'description-list', group: 'Data Display', section: 'Lists & tables', blurb: 'Text + Divider term/definition pairs.' },
  { name: 'KanbanBoard', slug: 'kanban-board', group: 'Data Display', section: 'Lists & tables', blurb: 'Column layout with drag and drop.' },
  { name: 'List', slug: 'list', group: 'Data Display', section: 'Lists & tables', blurb: 'Layout wrapper owning row rhythm and separators.' },
  { name: 'ListItem', slug: 'list-item', group: 'Data Display', section: 'Lists & tables', blurb: 'IconTile/Avatar + Text; the subscriptions and transactions row.' },
  { name: 'Table', slug: 'table', group: 'Data Display', section: 'Lists & tables', blurb: 'Semantic table styled on the line and surface tokens.' },
  { name: 'Timeline', slug: 'timeline', group: 'Data Display', section: 'Lists & tables', blurb: 'StatusDot + Divider + Text event sequence.' },
  { name: 'TreeView', slug: 'tree-view', group: 'Data Display', section: 'Lists & tables', blurb: 'Recursive disclosure with full tree keyboard semantics.' },
  { name: 'VirtualList', slug: 'virtual-list', group: 'Data Display', section: 'Lists & tables', blurb: 'Renders only the rows in view, so ten thousand items cost a few dozen nodes and are still announced as ten thousand.' },
  { name: 'FileList', slug: 'file-list', group: 'Data Display', section: 'Lists & tables', blurb: 'File rows with a type glyph, readable size and date, upload progress or the error in words with Retry, optional selection and a row menu.' },
  { name: 'TreeTable', slug: 'tree-table', group: 'Data Display', section: 'Lists & tables', blurb: 'Nested rows under shared columns, with treegrid semantics, the tree keyboard model, expand and collapse all, and parent totals rolled up from leaves.' },
  { name: 'EditableTable', slug: 'editable-table', group: 'Data Display', section: 'Lists & tables', blurb: 'A spreadsheet-style grid: arrows move, typing or Enter edits, Enter commits down, Tab across, Escape restores, with a check on every cell.' },
  { name: 'Leaderboard', slug: 'leaderboard', group: 'Data Display', section: 'Lists & tables', blurb: 'A ranking with shared ranks for ties, movement arrows, an optional podium for the top three, and your own row pinned when outside the top N.' },
  // Data Display / Metrics
  { name: 'Metric', slug: 'metric', group: 'Data Display', section: 'Metrics', blurb: 'Text + Badge: a label, a figure and a delta.' },
  { name: 'MetricSpotlight', slug: 'metric-spotlight', group: 'Data Display', section: 'Metrics', blurb: 'A KPI rail where selecting a tile drives a detail chart — the summary-then-detail dance every analytics screen reinvents.' },
  { name: 'StatCard', slug: 'stat-card', group: 'Data Display', section: 'Metrics', blurb: 'Surface(tile) + IconTile + Metric + Meter. The instalment tile.' },
  // Data Display / Records
  { name: 'AuditTrail', slug: 'audit-trail', group: 'Data Display', section: 'Records', blurb: 'Who changed what, when, and what it was before — the field every implementation drops first.' },
  { name: 'CodeBlock', slug: 'code-block', group: 'Data Display', section: 'Records', blurb: 'Surface(sunken) + monospace scale + copy action.' },
  { name: 'DiffSummary', slug: 'diff-summary', group: 'Data Display', section: 'Records', blurb: 'What is about to change, per field, before submitting. Cleared and newly set are their own facts.' },
  { name: 'DiffView', slug: 'diff-view', group: 'Data Display', section: 'Records', blurb: 'Two-column CodeBlock with change highlighting.' },
  { name: 'JsonViewer', slug: 'json-viewer', group: 'Data Display', section: 'Records', blurb: 'A payload as a collapsible tree in the code palette. Collapsing hides a branch; it never truncates a value.' },
  { name: 'MaskedValue', slug: 'masked-value', group: 'Data Display', section: 'Records', blurb: 'A sensitive value that is not in the DOM until revealed, hides itself again, and separates copy from reveal.' },
  { name: 'RelativeTime', slug: 'relative-time', group: 'Data Display', section: 'Records', blurb: '"3 minutes ago", phrased by Intl in any locale and kept current, over a real time element with the exact moment.' },
  { name: 'ReviewSummary', slug: 'review-summary', group: 'Data Display', section: 'Records', blurb: 'Average stars, total and a 5→1 distribution whose bars are pressed-state filters, so the place you spot the 2-star reviews is where you open them.' },
  { name: 'ProductCard', slug: 'product-card', group: 'Data Display', section: 'Records', blurb: 'Photo with a hover second shot, sale or new badge, struck-through old price, radio swatches, a wishlist toggle and an add-to-cart that reports its own result.' },
  { name: 'OrderTracker', slug: 'order-tracker', group: 'Data Display', section: 'Records', blurb: 'Ordered → delivered as an ordered list with aria-current, step times, estimated delivery, and the tracking number one press from the clipboard.' },
  { name: 'EventCalendar', slug: 'event-calendar', group: 'Data Display', section: 'Records', blurb: 'A month of events as chips on fixed-height days, with +n more opening the whole day, date-grid keys and a Monday or Sunday week start.' },
  { name: 'AgendaList', slug: 'agenda-list', group: 'Data Display', section: 'Records', blurb: 'Upcoming events grouped under sticky day headings, named Today and Tomorrow, with empty days skipped and a now line through today.' },
  { name: 'CodeTabs', slug: 'code-tabs', group: 'Data Display', section: 'Records', blurb: 'One snippet in tabs such as npm, pnpm and yarn, with copy, and a storage key that makes one choice switch and stay on every block.' },
  // Data Display / Media
  { name: 'Figure', slug: 'figure', group: 'Data Display', section: 'Media', blurb: 'Image + Text caption.' },
  { name: 'QRCode', slug: 'qr-code', group: 'Data Display', section: 'Media', blurb: 'Encoded matrix rendered as SVG. The QR quick action.' },
  { name: 'ImageGallery', slug: 'image-gallery', group: 'Data Display', section: 'Media', blurb: 'A main image with a thumbnail tablist, arrow keys, previous and next buttons and a counter; clicking opens Lightbox on the same image.' },
  { name: 'VideoPlayer', slug: 'video-player', group: 'Data Display', section: 'Media', blurb: 'A video with labelled controls under the picture — seek, volume, captions, speed, full screen — and shortcuts that only work while focus is inside.' },
  { name: 'AudioPlayer', slug: 'audio-player', group: 'Data Display', section: 'Media', blurb: 'Spoken audio with play, seek, time and speed, a waveform that doubles as the seek bar, and a chapter list that marks what is playing.' },
  // Charts / Plots
  { name: 'AreaChart', slug: 'area-chart', group: 'Charts', section: 'Plots', blurb: 'LineChart with a filled band.' },
  { name: 'BarChart', slug: 'bar-chart', group: 'Charts', section: 'Plots', blurb: 'Categorical bars sharing the chart scaffolding.' },
  { name: 'LineChart', slug: 'line-chart', group: 'Charts', section: 'Plots', blurb: 'Axes, scales, Legend and ChartTooltip.' },
  { name: 'LiveChart', slug: 'live-chart', group: 'Charts', section: 'Plots', blurb: 'A line that scrolls as samples land. One CSS transition per sample, and a scale that eases towards its bounds.' },
  { name: 'Sparkline', slug: 'sparkline', group: 'Charts', section: 'Plots', blurb: 'Inline SVG trend line; no axes, no chart runtime.' },
  { name: 'ScatterChart', slug: 'scatter-chart', group: 'Charts', section: 'Plots', blurb: 'X against Y with optional bubble size and a least-squares trend line, one tab stop with arrow keys to step through points in x order.' },
  { name: 'WaterfallChart', slug: 'waterfall-chart', group: 'Charts', section: 'Plots', blurb: 'Floating bars from a starting value, with subtotals and totals computed rather than typed, so the bridge always adds up.' },
  { name: 'SlopeChart', slug: 'slope-chart', group: 'Charts', section: 'Plots', blurb: 'Each item’s change between two moments as one line, with labels at both ends nudged apart, rise and fall tones, and focus that fades the rest.' },
  { name: 'DumbbellChart', slug: 'dumbbell-chart', group: 'Charts', section: 'Plots', blurb: 'Two values per category as dots joined by a bar, so the gap is what you see, with optional sorting by the biggest change.' },
  // Charts / Gauges & rings
  { name: 'ProgressChart', slug: 'progress-chart', group: 'Charts', section: 'Gauges & rings', blurb: 'Stacked Progress bars for part-to-whole comparison.' },
  { name: 'RadialGauge', slug: 'radial-gauge', group: 'Charts', section: 'Gauges & rings', blurb: 'ProgressRing with a scale and a value readout.' },
  { name: 'BulletChart', slug: 'bullet-chart', group: 'Charts', section: 'Gauges & rings', blurb: 'Stephen Few’s bullet graph: a measure, its target and its range in one row, shaded in ink so it still reads in greyscale.' },
  { name: 'RadialBarChart', slug: 'radial-bar-chart', group: 'Charts', section: 'Gauges & rings', blurb: 'Concentric rings that each fill toward their own target or a shared one, labelled at the start, with the total in the centre and a legend.' },
  // Charts / Distribution
  { name: 'BarList', slug: 'bar-list', group: 'Charts', section: 'Distribution', blurb: 'Ranked horizontal bars as a real list - top pages, top referrers - the chart every dashboard actually needs.' },
  { name: 'CategoryBar', slug: 'category-bar', group: 'Charts', section: 'Distribution', blurb: 'One bar split into its parts, with unused capacity and an optional limit marker. Lengths, not angles.' },
  { name: 'DonutChart', slug: 'donut-chart', group: 'Charts', section: 'Distribution', blurb: 'Part-to-whole arcs with a centre readout.' },
  { name: 'DotGlobe', slug: 'dot-globe', group: 'Charts', section: 'Distribution', blurb: 'A turning sphere of dots with places marked on it. A golden-angle spiral, because a lat/long grid bunches at the poles.' },
  { name: 'RadarChart', slug: 'radar-chart', group: 'Charts', section: 'Distribution', blurb: 'Several measures at once as a shape. Per-axis maxima, so measures on different units can share one outline.' },
  { name: 'Histogram', slug: 'histogram', group: 'Charts', section: 'Distribution', blurb: 'Raw values counted into bins with round edges, plus optional mean and median markers, because on skewed data the gap between them is the finding.' },
  { name: 'BoxPlot', slug: 'box-plot', group: 'Charts', section: 'Distribution', blurb: 'Quartiles, whiskers at 1.5 IQR and each outlier as its own dot, from raw values or a given summary, vertical or horizontal.' },
  { name: 'MatrixHeatmap', slug: 'matrix-heatmap', group: 'Charts', section: 'Distribution', blurb: 'A rows-by-columns grid on a stepped accent scale, with a legend, cell tooltips, printed values that stay readable, and arrow keys in two dimensions.' },
  { name: 'ParetoChart', slug: 'pareto-chart', group: 'Charts', section: 'Distribution', blurb: 'Causes sorted largest first with a cumulative share line on its own axis, a dashed cutoff, and the long tail muted rather than dropped.' },
  // Charts / Flow & hierarchy
  { name: 'FunnelChart', slug: 'funnel-chart', group: 'Charts', section: 'Flow & hierarchy', blurb: 'Conversion through ordered steps: each bar against the start, each gap as the share that continued.' },
  { name: 'SankeyFlow', slug: 'sankey-flow', group: 'Charts', section: 'Flow & hierarchy', blurb: 'Where an amount comes from and goes, as ribbons whose thickness is the amount. Columns by longest path, so nothing flows backwards.' },
  { name: 'TreeMap', slug: 'tree-map', group: 'Charts', section: 'Flow & hierarchy', blurb: 'Part-to-whole by area, squarified so no tile becomes a sliver. Shows a long tail a donut cannot.' },
  // Charts / Time & activity
  { name: 'ActivityHeatmap', slug: 'activity-heatmap', group: 'Charts', section: 'Time & activity', blurb: 'A calendar density grid. It answers a question no chart here answers well: when did this happen, across months, at a glance.' },
  { name: 'DaySchedule', slug: 'day-schedule', group: 'Charts', section: 'Time & activity', blurb: 'A day of events with overlaps resolved by cluster and first-fit columns, positioned from minutes.' },
  { name: 'StatusStrip', slug: 'status-strip', group: 'Charts', section: 'Time & activity', blurb: 'The uptime strip, with missing data drawn as its own state rather than as an outage.' },
  { name: 'CandlestickChart', slug: 'candlestick-chart', group: 'Charts', section: 'Time & activity', blurb: 'OHLC candles, hollow when up and solid when down as well as coloured, with a volume pane and a crosshair that prints the price.' },
  { name: 'GanttChart', slug: 'gantt-chart', group: 'Charts', section: 'Time & activity', blurb: 'Tasks as bars on a scrolling calendar by lane, with progress fills, dependency arrows, milestone diamonds, a today line and day, week or month zoom.' },
  // Charts / Chart parts
  { name: 'ChartTooltip', slug: 'chart-tooltip', group: 'Charts', section: 'Chart parts', blurb: 'Tooltip specialised for a data point.' },
  { name: 'Legend', slug: 'legend', group: 'Charts', section: 'Chart parts', blurb: 'StatusDot + Text series key, shared by every chart.' },
  // Feedback / Status
  { name: 'GooeyLoader', slug: 'gooey-loader', group: 'Feedback', section: 'Status', blurb: 'Metaballs: blur the group, then push alpha through a steep contrast curve so overlapping edges fuse.' },
  { name: 'LoadingOverlay', slug: 'loading-overlay', group: 'Feedback', section: 'Status', blurb: 'Spinner over a scrim, scoped to a container.' },
  { name: 'Meter', slug: 'meter', group: 'Feedback', section: 'Status', blurb: 'Discrete, counted progress - eight pips of which three are filled, rather than a continuous bar.' },
  { name: 'Progress', slug: 'progress', group: 'Feedback', section: 'Status', blurb: 'Continuous bar, for values that are genuinely fractional.' },
  { name: 'ProgressRing', slug: 'progress-ring', group: 'Feedback', section: 'Status', blurb: 'The same value drawn as an arc, for square slots.' },
  { name: 'Skeleton', slug: 'skeleton', group: 'Feedback', section: 'Status', blurb: 'Geometry plus a shimmer; no knowledge of what it stands in for.' },
  { name: 'Spinner', slug: 'spinner', group: 'Feedback', section: 'Status', blurb: 'Leaf consumed by Button and IconButton.' },
  { name: 'StatusDot', slug: 'status-dot', group: 'Feedback', section: 'Status', blurb: 'A token-coloured circle.' },
  { name: 'UptimeBar', slug: 'uptime-bar', group: 'Feedback', section: 'Status', blurb: 'A 90-day status-page row with an incident tooltip per day and an uptime percentage that leaves out days with no data.' },
  { name: 'UploadQueue', slug: 'upload-queue', group: 'Feedback', section: 'Status', blurb: 'Every upload in one panel: per-file progress, pause, resume, cancel and retry, overall progress by bytes, clear completed, and a collapsed pill.' },
  // Feedback / Messages
  { name: 'Alert', slug: 'alert', group: 'Feedback', section: 'Messages', blurb: 'Surface + IconTile + Text; a persistent message block.' },
  { name: 'Banner', slug: 'banner', group: 'Feedback', section: 'Messages', blurb: 'Full-width Alert with a dismiss action.' },
  { name: 'InlineMessage', slug: 'inline-message', group: 'Feedback', section: 'Messages', blurb: 'The compact form of Alert, for use under a Field.' },
  { name: 'NotificationCenter', slug: 'notification-center', group: 'Feedback', section: 'Messages', blurb: 'The panel behind the bell, with a real unread model announced through a badge rather than by colour.' },
  { name: 'Toast', slug: 'toast', group: 'Feedback', section: 'Messages', blurb: 'Portal-mounted queue with timers and a live region.' },
  // Feedback / Empty & error
  { name: 'EmptyState', slug: 'empty-state', group: 'Feedback', section: 'Empty & error', blurb: 'Surface + IconTile + Text + Button.' },
  { name: 'ErrorState', slug: 'error-state', group: 'Feedback', section: 'Empty & error', blurb: 'EmptyState with a retry action and error semantics.' },
  { name: 'StateView', slug: 'state-view', group: 'Feedback', section: 'Empty & error', blurb: 'One component for the four states every data region has. Every list rebuilds this branch, and each rebuild forgets one — usually the empty case.' },
  // Feedback / System state
  { name: 'ConnectionBanner', slug: 'connection-banner', group: 'Feedback', section: 'System state', blurb: 'Offline, reconnecting, and what is still queued. navigator.onLine is the default, not the authority — a dead API reads as online.' },
  { name: 'Countdown', slug: 'countdown', group: 'Feedback', section: 'System state', blurb: 'Time remaining, in tiles - a silent timer role rather than a live region that talks every second.' },
  { name: 'RateLimitMeter', slug: 'rate-limit-meter', group: 'Feedback', section: 'System state', blurb: 'How much of a quota is gone and when it returns — recomputed from a deadline, so a throttled tab cannot drift.' },
  { name: 'RetryQueue', slug: 'retry-queue', group: 'Feedback', section: 'System state', blurb: 'The changes that have not landed, with the backoff shown — a countdown is what stops everyone fighting the retry.' },
  { name: 'SaveIndicator', slug: 'save-indicator', group: 'Feedback', section: 'System state', blurb: 'What autosave is doing, and when it last succeeded — the timestamp is what turns “Saved” into a claim.' },
  { name: 'SessionTimeout', slug: 'session-timeout', group: 'Feedback', section: 'System state', blurb: 'The idle warning, with activity shared between tabs and a deadline held as a timestamp, so a sleeping laptop cannot cheat it.' },
  { name: 'IncidentTimeline', slug: 'incident-timeline', group: 'Feedback', section: 'System state', blurb: 'One incident’s updates newest first, with severity, affected components, and a duration that says Ongoing for until it is resolved.' },
  { name: 'StepLoader', slug: 'step-loader', group: 'Feedback', section: 'System state', blurb: 'A background job as a step checklist, with the current step and elapsed time in the header, a retry on the failed step, and a collapsible list.' },
  // Feedback / Celebration
  { name: 'AchievementPop', slug: 'achievement-pop', group: 'Feedback', section: 'Celebration', blurb: 'Overshoot on the landing, and the shine sweeps after it — overlapping them wastes both.' },
  { name: 'Confetti', slug: 'confetti', group: 'Feedback', section: 'Celebration', blurb: 'Canvas celebration burst.' },
  { name: 'StreakCounter', slug: 'streak-counter', group: 'Feedback', section: 'Celebration', blurb: 'A flame that only flickers once today is banked, and keeps its final number when the streak ends.' },
  { name: 'SuccessMark', slug: 'success-mark', group: 'Feedback', section: 'Celebration', blurb: 'Animated confirmation tick.' },
  { name: 'XPBar', slug: 'xp-bar', group: 'Feedback', section: 'Celebration', blurb: 'The overflow is the point: fill to full, snap to zero with the transition off, continue. Otherwise the bar sweeps backwards.' },
  // Overlays / Dialogs
  { name: 'ActionSheet', slug: 'action-sheet', group: 'Overlays', section: 'Dialogs', blurb: 'Drawer anchored to the bottom, for touch.' },
  { name: 'AlertDialog', slug: 'alert-dialog', group: 'Overlays', section: 'Dialogs', blurb: 'Modal with alertdialog semantics and a forced choice.' },
  { name: 'ConfirmDialog', slug: 'confirm-dialog', group: 'Overlays', section: 'Dialogs', blurb: 'AlertDialog with a standard confirm/cancel pair.' },
  { name: 'Drawer', slug: 'drawer', group: 'Overlays', section: 'Dialogs', blurb: 'Modal anchored to an edge. The mobile navigation panel.' },
  { name: 'Lightbox', slug: 'lightbox', group: 'Overlays', section: 'Dialogs', blurb: 'Full-screen images with arrow keys, swipe and a spoken position, built the way Modal is.' },
  { name: 'Modal', slug: 'modal', group: 'Overlays', section: 'Dialogs', blurb: 'Portal + FocusTrap in a centred Surface.' },
  { name: 'MorphDialog', slug: 'morph-dialog', group: 'Overlays', section: 'Dialogs', blurb: 'A card that expands into a dialog from exactly where it sits, as a FLIP transform, so nothing relayouts mid-flight.' },
  { name: 'KeyboardShortcutsDialog', slug: 'keyboard-shortcuts-dialog', group: 'Overlays', section: 'Dialogs', blurb: 'Every shortcut on one screen, grouped by area and opened with ?, with a filter and keys drawn for the device: ⌘ on a Mac, Ctrl elsewhere.' },
  { name: 'PromptDialog', slug: 'prompt-dialog', group: 'Overlays', section: 'Dialogs', blurb: 'Asks for one value, like a rename or a new folder: opens with the text selected, checks as you type, submits on Enter and keeps a failed save open.' },
  { name: 'ReleaseNotesModal', slug: 'release-notes-modal', group: 'Overlays', section: 'Dialogs', blurb: 'What’s new, one highlight per page with media and a step indicator, shown once per version and remembered in storage, with a quiet opt-out.' },
  // Overlays / Popovers
  { name: 'HoverCard', slug: 'hover-card', group: 'Overlays', section: 'Popovers', blurb: 'Popover on hover intent rather than click.' },
  { name: 'Popover', slug: 'popover', group: 'Overlays', section: 'Popovers', blurb: 'Positioned Surface(floating); the shared anchor logic.' },
  { name: 'Tooltip', slug: 'tooltip', group: 'Overlays', section: 'Popovers', blurb: 'Surface(floating) + Text; replaces the native title on icon-only controls.' },
  { name: 'ConfirmPopover', slug: 'confirm-popover', group: 'Overlays', section: 'Popovers', blurb: 'An are-you-sure anchored to its trigger: focus lands on Cancel, Escape or an outside click backs out, and an async confirm stays pending and shows the error if it fails.' },
  { name: 'Toggletip', slug: 'toggletip', group: 'Overlays', section: 'Popovers', blurb: 'An info button that opens an explanation on click, Enter or Space and announces it. Unlike Tooltip it never needs hover and can hold links.' },
  // Overlays / Guidance
  { name: 'CoachTour', slug: 'coach-tour', group: 'Overlays', section: 'Guidance', blurb: 'A guided tour that cuts a hole in the scrim over each target, scrolls it into view and anchors an explanation to it.' },
  { name: 'Spotlight', slug: 'spotlight', group: 'Overlays', section: 'Guidance', blurb: 'Pointer-following highlight over a surface.' },
  // Motion & Effects / Entrance & scroll
  { name: 'PageTransition', slug: 'page-transition', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'Route-level enter and exit, built on Presence.' },
  { name: 'Parallax', slug: 'parallax', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'Scroll-linked depth for a page region.' },
  { name: 'Reveal', slug: 'reveal', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'Scroll-triggered entrance for a page region.' },
  { name: 'ScrollProgress', slug: 'scroll-progress', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'How far through a page or a container the reader is, coalesced to one measurement a frame, doubling as back-to-top.' },
  { name: 'ScrollVelocity', slug: 'scroll-velocity', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'Skew, drift and squash driven by how fast you are scrolling, eased so a wheel burst reads as weight.' },
  { name: 'Stagger', slug: 'stagger', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'Sequences Reveal across a list.' },
  { name: 'AnimatedList', slug: 'animated-list', group: 'Motion & Effects', section: 'Entrance & scroll', blurb: 'Rows animate in when added and fold away when removed, matched by key. Focus moves off a leaving row, and nothing animates under reduced motion.' },
  // Motion & Effects / Text
  { name: 'GlitchText', slug: 'glitch-text', group: 'Motion & Effects', section: 'Text', blurb: 'RGB channel tear that is clean ninety per cent of the time — and only one of the three copies is readable.' },
  { name: 'GradientText', slug: 'gradient-text', group: 'Motion & Effects', section: 'Text', blurb: 'A gradient sliding across live text. Duplicated end to end so the loop has no seam, and the glyphs stay selectable throughout.' },
  { name: 'KineticText', slug: 'kinetic-text', group: 'Motion & Effects', section: 'Text', blurb: 'Per-character animated headline.' },
  { name: 'RotatingWord', slug: 'rotating-word', group: 'Motion & Effects', section: 'Text', blurb: 'Cycles a word inside a headline.' },
  { name: 'TextReveal', slug: 'text-reveal', group: 'Motion & Effects', section: 'Text', blurb: 'A passage whose words light as it scrolls. Scroll-linked rather than triggered: the reader sets the pace and can scroll back.' },
  { name: 'TextScramble', slug: 'text-scramble', group: 'Motion & Effects', section: 'Text', blurb: 'Character-scramble text reveal.' },
  { name: 'Typewriter', slug: 'typewriter', group: 'Motion & Effects', section: 'Text', blurb: 'Text that types, deletes and moves on. Announced once as static text, with the width of the longest phrase held open.' },
  { name: 'MarkerHighlight', slug: 'marker-highlight', group: 'Motion & Effects', section: 'Text', blurb: 'A hand-drawn underline, highlight, circle or box drawn in behind real text as it scrolls into view, tinted from the accent; already drawn under reduced motion.' },
  { name: 'ShimmerText', slug: 'shimmer-text', group: 'Motion & Effects', section: 'Text', blurb: 'A band of light sweeping across real, selectable text for Thinking… states, plain under reduced motion or when paused.' },
  // Motion & Effects / Surfaces & light
  { name: 'AnimatedBeam', slug: 'animated-beam', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'A curved connector between two real elements with light pulsing along it. It re-measures, so it survives a reflow.' },
  { name: 'AuroraSurface', slug: 'aurora-surface', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Three drifting colour fields behind a container. Only transform animates, so a full-bleed hero holds 60fps where an animated filter would not.' },
  { name: 'BlobMorph', slug: 'blob-morph', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'An organic outline on two unrelated sine frequencies, joined by Catmull–Rom, so it never repeats and never flattens.' },
  { name: 'BorderBeam', slug: 'border-beam', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Light travelling round a border: one spinning conic gradient behind an inset opaque surface, so it holds at any aspect ratio.' },
  { name: 'HoloCard', slug: 'holo-card', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Trading-card foil. The rainbow runs against the tilt, because real foil reflects a fixed light.' },
  { name: 'LiquidGlass', slug: 'liquid-glass', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Glass that actually refracts: a blur, a specular rim, and an SVG displacement map that bends only the edge.' },
  { name: 'NeonSign', slug: 'neon-sign', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Three stacked glows rather than one blur, and a flicker that clusters its dropouts like a real tube.' },
  { name: 'OrbitRing', slug: 'orbit-ring', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Items travelling a circle, each counter-rotating so it stays upright — the detail that stops logos arriving upside down.' },
  { name: 'ParticleField', slug: 'particle-field', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'A drifting constellation on a canvas, linked and pointer-reactive. Canvas, because the link pass is quadratic over positions.' },
  { name: 'RippleSurface', slug: 'ripple-surface', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'Water. Every drop keeps its own birth timestamp, so six ripples overlap correctly instead of restarting each other.' },
  { name: 'StickerPeel', slug: 'sticker-peel', group: 'Motion & Effects', section: 'Surfaces & light', blurb: 'A corner that lifts, casts a shadow on the sheet below, and comes off if you pull past the threshold.' },
  // Motion & Effects / Numbers
  { name: 'AnimatedNumber', slug: 'animated-number', group: 'Motion & Effects', section: 'Numbers', blurb: 'Tweens between two values. Owns an animation frame loop.' },
  { name: 'CountUp', slug: 'count-up', group: 'Motion & Effects', section: 'Numbers', blurb: 'AnimatedNumber triggered on entering the viewport.' },
  { name: 'Odometer', slug: 'odometer', group: 'Motion & Effects', section: 'Numbers', blurb: 'Digit-roll presentation of AnimatedNumber.' },
  { name: 'SplitFlap', slug: 'split-flap', group: 'Motion & Effects', section: 'Numbers', blurb: 'Split-flap board presentation of a value.' },
  { name: 'Ticker', slug: 'ticker', group: 'Motion & Effects', section: 'Numbers', blurb: 'Continuously updating value strip.' },
  // Motion & Effects / Micro-interaction
  { name: 'CursorAura', slug: 'cursor-aura', group: 'Motion & Effects', section: 'Micro-interaction', blurb: 'A cursor with mass that becomes the rectangle of whatever it hovers, and hides the real pointer while it does.' },
  { name: 'FlipCard', slug: 'flip-card', group: 'Motion & Effects', section: 'Micro-interaction', blurb: 'Two-faced Card with a flip transition.' },
  { name: 'PressScale', slug: 'press-scale', group: 'Motion & Effects', section: 'Micro-interaction', blurb: 'Press-down scale feedback wrapper.' },
  { name: 'Ripple', slug: 'ripple', group: 'Motion & Effects', section: 'Micro-interaction', blurb: 'Pointer-origin ripple wrapper. Owns transient state.' },
  { name: 'TiltCard', slug: 'tilt-card', group: 'Motion & Effects', section: 'Micro-interaction', blurb: 'Pointer-tilted Card.' },
  // Interaction / Touch & drag
  { name: 'ImageCompare', slug: 'image-compare', group: 'Interaction', section: 'Touch & drag', blurb: 'Two states split by a handle. The top layer is clipped, not resized, so nothing reflows during the drag.' },
  { name: 'MarqueeSelect', slug: 'marquee-select', group: 'Interaction', section: 'Touch & drag', blurb: 'Drag a rectangle to select. Items are found by attribute and measured once, at the start of the drag.' },
  { name: 'MiniMap', slug: 'mini-map', group: 'Interaction', section: 'Touch & drag', blurb: 'A scaled survey with the on-screen part outlined and draggable. Takes content coordinates, so it knows nothing about transforms.' },
  { name: 'PanZoom', slug: 'pan-zoom', group: 'Interaction', section: 'Touch & drag', blurb: 'A viewport you pan and zoom, anchored to the pointer. One affine step, so a minimap or a hit test on top stays tractable.' },
  { name: 'PullToRefresh', slug: 'pull-to-refresh', group: 'Interaction', section: 'Touch & drag', blurb: 'Drag past a threshold to reload, but only from the very top — the rule that stops it stealing an ordinary scroll.' },
  { name: 'SortableList', slug: 'sortable-list', group: 'Interaction', section: 'Touch & drag', blurb: 'Drag to reorder, with rows measured once on grab. Space picks a row up and the arrows move it, announced through a live region.' },
  { name: 'StoryProgress', slug: 'story-progress', group: 'Interaction', section: 'Touch & drag', blurb: 'The segmented bar above a story. Re-keyed on the index, which is what makes a re-entered segment actually restart.' },
  { name: 'SwipeDeck', slug: 'swipe-deck', group: 'Interaction', section: 'Touch & drag', blurb: 'A stack of cards thrown left or right, with pointer capture for the gesture and arrow keys for everyone not holding a pointer.' },
  { name: 'SwipeRow', slug: 'swipe-row', group: 'Interaction', section: 'Touch & drag', blurb: 'A row that slides aside to reveal actions that are always real buttons — focusing one opens the row.' },
  { name: 'ResizableBox', slug: 'resizable-box', group: 'Interaction', section: 'Touch & drag', blurb: 'A box with right, bottom and corner handles that are focusable separators, with limits, arrow keys, and Shift to keep the shape.' },
  // Interaction / Presence & collaboration
  { name: 'PresenceBar', slug: 'presence-bar', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Who is here, in a stable order a join cannot reshuffle, with arrivals announced rather than only drawn.' },
  { name: 'PresenceCursors', slug: 'presence-cursors', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Other people’s pointers, glided between sparse updates by a CSS transition, positioned in fractions so a resize is free.' },
  { name: 'ReactionBar', slug: 'reaction-bar', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Reactions with counts and a burst on pick. A toggle, not an increment, so a double tap cannot leave two likes.' },
  { name: 'TypingIndicator', slug: 'typing-indicator', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Three dots and a sentence that is actually grammatical — one, two and many are three different shapes.' },
  { name: 'VibePoll', slug: 'vibe-poll', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Results hidden until you vote, and each row is its own bar, so the label stays legible as the fill passes it.' },
  { name: 'ChatThread', slug: 'chat-thread', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Messages grouped by sender and time, with day dividers and delivery ticks. Follows new messages only while you are at the bottom, otherwise offers a jump.' },
  { name: 'MessageComposer', slug: 'message-composer', group: 'Interaction', section: 'Presence & collaboration', blurb: 'A growing chat input: Enter sends, attachments are removable chips, a character counter, and send is blocked while empty or already sending.' },
  { name: 'CommentThread', slug: 'comment-thread', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Threaded comments with a depth cap, inline reply and edit, reactions, delete with a confirm, collapsible replies and a resolve toggle.' },
  { name: 'ImageAnnotator', slug: 'image-annotator', group: 'Interaction', section: 'Presence & collaboration', blurb: 'Numbered pins on an image with a note each, placed by click or a keyboard crosshair, stored as percentages so they stay put at any size.' },
  // Interaction / Trust & workflow
  { name: 'ApprovalChain', slug: 'approval-chain', group: 'Interaction', section: 'Trust & workflow', blurb: 'Parallel sign-off against a quorum, not a stepper. One rejection ends it however many approvals are in.' },
  { name: 'ConsentManager', slug: 'consent-manager', group: 'Interaction', section: 'Trust & workflow', blurb: 'Granular consent where rejecting is exactly as easy as accepting, and every recipient is named.' },
  { name: 'DataFreshness', slug: 'data-freshness', group: 'Interaction', section: 'Trust & workflow', blurb: 'When this data was last true, and whether that is still good enough. A failed refresh makes it older, not wrong.' },
  { name: 'ImportMapper', slug: 'import-mapper', group: 'Interaction', section: 'Trust & workflow', blurb: 'Column-to-field matching that guesses first, previews real values, and catches clashes while the file is still on screen.' },
  { name: 'PermissionGate', slug: 'permission-gate', group: 'Interaction', section: 'Trust & workflow', blurb: 'Shows a region to those who may see it and explains the refusal to those who may not. Silence is opt-in.' },
  { name: 'UndoStack', slug: 'undo-stack', group: 'Interaction', section: 'Trust & workflow', blurb: 'Undo and redo with the steps named, plus a history to jump back through. Leaves a focused field’s own undo alone.' },
  // Canvas & Play / Generative
  { name: 'AsciiImage', slug: 'ascii-image', group: 'Canvas & Play', section: 'Generative', blurb: 'An image redrawn as characters, downscaled by the browser and mapped through a ramp ordered by ink.' },
  { name: 'BoidsFlock', slug: 'boids-flock', group: 'Canvas & Play', section: 'Generative', blurb: 'Separation, alignment, cohesion — on a spatial grid, so two hundred boids is hundreds of checks and not forty thousand.' },
  { name: 'MatrixRain', slug: 'matrix-rain', group: 'Canvas & Play', section: 'Generative', blurb: 'Falling glyphs where the trail is accumulated residue, not a list of characters anyone tracks.' },
  { name: 'StarField', slug: 'star-field', group: 'Canvas & Play', section: 'Generative', blurb: 'A perspective divide and nothing else, with streaks drawn between each star now and last frame.' },
  { name: 'GameOfLife', slug: 'game-of-life', group: 'Canvas & Play', section: 'Generative', blurb: 'Conway’s Life on a canvas with play, step, clear, randomise and speed, drawing by mouse or keyboard, pausing off screen, and theme-aware colours.' },
  // Canvas & Play / Audio
  { name: 'AudioVisualizer', slug: 'audio-visualizer', group: 'Canvas & Play', section: 'Audio', blurb: 'A real FFT from a real element or the microphone, trimmed to the part of the spectrum with anything in it.' },
  { name: 'PianoKeys', slug: 'piano-keys', group: 'Canvas & Play', section: 'Audio', blurb: 'One oscillator per note with a ramped envelope, because a gain that jumps to 1 is a click.' },
  { name: 'Waveform', slug: 'waveform', group: 'Canvas & Play', section: 'Audio', blurb: 'The bar visualiser, with a playhead. One scaleY keyframe per bar rather than a frame loop writing heights.' },
  // Canvas & Play / Physics
  { name: 'DiceRoller', slug: 'dice-roller', group: 'Canvas & Play', section: 'Physics', blurb: 'The result is decided first and the tumble is arranged to arrive at it, not read off wherever it stopped.' },
  { name: 'GravityTags', slug: 'gravity-tags', group: 'Canvas & Play', section: 'Physics', blurb: 'Real elements that fall and stack, separated along the smaller overlap so the pile does not slide apart.' },
  { name: 'RopeCursor', slug: 'rope-cursor', group: 'Canvas & Play', section: 'Physics', blurb: 'Verlet integration: velocity is implied by position, which is what makes the constraint pass so simple.' },
  { name: 'SlotReels', slug: 'slot-reels', group: 'Canvas & Play', section: 'Physics', blurb: 'Reels that land on a chosen result and stop left to right, because the stagger is the whole drama.' },
  // Canvas & Play / Toys
  { name: 'FlipBook', slug: 'flip-book', group: 'Canvas & Play', section: 'Toys', blurb: 'Leaves with two faces, the back mirrored, and z-index taken from distance to the current spread.' },
  { name: 'PixelCanvas', slug: 'pixel-canvas', group: 'Canvas & Play', section: 'Toys', blurb: 'A grid of buttons with interpolated strokes, storing palette indices rather than colours.' },
  { name: 'ScratchCard', slug: 'scratch-card', group: 'Canvas & Play', section: 'Toys', blurb: 'A cover erased with the pointer to reveal what is under it, with a real button beside it, because a gesture is not an interface.' },
  { name: 'Terminal', slug: 'terminal', group: 'Canvas & Play', section: 'Toys', blurb: 'History that preserves the half-typed draft, and a real input under the caret so IME and paste behave.' },
  { name: 'MemoryGame', slug: 'memory-game', group: 'Canvas & Play', section: 'Toys', blurb: 'Card-matching pairs on a keyboard-navigable grid, with moves, a timer and spoken matches. Cards change face in place under reduced motion.' },
  // SaaS / Marketing
  { name: 'CtaSection', slug: 'cta-section', group: 'SaaS', section: 'Marketing', blurb: 'The closing ask at the foot of a page, on the banner radius. Accent copy uses the derived accent-ink, so a deep brand colour gets white text.' },
  { name: 'FeatureGrid', slug: 'feature-grid', group: 'SaaS', section: 'Marketing', blurb: 'Benefit-led features with glyph, name, one sentence and a “Learn more” that carries the feature name for assistive tech.' },
  { name: 'HeroSection', slug: 'hero-section', group: 'SaaS', section: 'Marketing', blurb: 'Announcement, promise, two actions and the product, on the display type scale. PromoBanner is an in-app card; this is the first screen of a site.' },
  { name: 'LogoCloud', slug: 'logo-cloud', group: 'SaaS', section: 'Marketing', blurb: 'Customer marks flattened to one tone, as a row, a hairline grid or a marquee — each exposed as an image named for the company.' },
  { name: 'SectionHeading', slug: 'section-heading', group: 'SaaS', section: 'Marketing', blurb: 'Eyebrow, display title and lede — the opening of every landing-page section, held to one measure so eight of them in a row do not drift.' },
  { name: 'SiteFooter', slug: 'site-footer', group: 'SaaS', section: 'Marketing', blurb: 'The site map: column titles as real headings, legal row, social links named for their network.' },
  { name: 'SiteHeader', slug: 'site-header', group: 'SaaS', section: 'Marketing', blurb: 'The marketing top bar. Navbar is the signed-in app header; this is links out and a sign-up, transparent over the hero until the page scrolls.' },
  { name: 'TestimonialCard', slug: 'testimonial-card', group: 'SaaS', section: 'Marketing', blurb: 'A quote with the person attached, as figure, blockquote and figcaption — the only structure that says whose words they are.' },
  // SaaS / Pricing
  { name: 'BillingToggle', slug: 'billing-toggle', group: 'SaaS', section: 'Pricing', blurb: 'Monthly or yearly, with the saving pinned beside the control rather than inside it, so the track never jumps.' },
  { name: 'FeatureComparison', slug: 'feature-comparison', group: 'SaaS', section: 'Pricing', blurb: 'The plan-by-feature matrix as a real table with row and group headers — and one plan at a time on a phone, instead of a sideways scroll.' },
  { name: 'PricingCard', slug: 'pricing-card', group: 'SaaS', section: 'Pricing', blurb: 'One plan: price, the action directly under it, then the list. Excluded features are announced as excluded.' },
  { name: 'PricingTable', slug: 'pricing-table', group: 'SaaS', section: 'Pricing', blurb: 'Plans behind a period switch. The yearly saving is computed from the plans, and the annual total that actually leaves the account is shown.' },
  // SaaS / Auth & onboarding
  { name: 'AuthCard', slug: 'auth-card', group: 'SaaS', section: 'Auth & onboarding', blurb: 'The frame for sign in, sign up, reset and invite: providers, the rule, the form, the way out — and the error announced at the top.' },
  { name: 'OnboardingWizard', slug: 'onboarding-wizard', group: 'SaaS', section: 'Auth & onboarding', blurb: 'Multi-step setup that validates each step in place, revisits only completed steps, and moves focus to each new step’s heading.' },
  { name: 'SetupChecklist', slug: 'setup-checklist', group: 'SaaS', section: 'Auth & onboarding', blurb: 'The “get set up” card. Steps are props, so it advances when work is done elsewhere; optional steps never hold completion hostage.' },
  // SaaS / Billing
  { name: 'CheckoutSummary', slug: 'checkout-summary', group: 'SaaS', section: 'Billing', blurb: 'Order lines, promo code, tax and what is due today — plus what is charged after today. Card entry is left to the provider’s hosted field.' },
  { name: 'InvoiceList', slug: 'invoice-list', group: 'SaaS', section: 'Billing', blurb: 'Billing history with Pay now in the row of any due or failed invoice, and downloads named for their invoice.' },
  { name: 'PaymentMethodCard', slug: 'payment-method-card', group: 'SaaS', section: 'Billing', blurb: 'A saved card whose expiry is worked out, not displayed — and a default card that cannot be removed out from under a subscription.' },
  { name: 'PlanSummary', slug: 'plan-summary', group: 'SaaS', section: 'Billing', blurb: 'Current plan, status, and the one date that matters next. A failed payment is a warning with the fix inside it, not a badge.' },
  { name: 'UpgradePrompt', slug: 'upgrade-prompt', group: 'SaaS', section: 'Billing', blurb: 'An upsell as a card, a top banner or inline where a gated feature would be, with a trial countdown derived from a date.' },
  { name: 'UsageMeter', slug: 'usage-meter', group: 'SaaS', section: 'Billing', blurb: 'Entitlements over a billing period — seats, storage, MAUs — with unlimited and over-the-limit as their own states. RateLimitMeter is the rolling window.' },
  { name: 'SeatSelector', slug: 'seat-selector', group: 'SaaS', section: 'Billing', blurb: 'Paid seats with a typed stepper that stops at seats in use, the new total, and today’s prorated charge with the arithmetic shown.' },
  { name: 'CancellationFlow', slug: 'cancellation-flow', group: 'SaaS', section: 'Billing', blurb: 'Honest cancellation: an optional reason, an offer that matches it, then a confirm listing what is lost and when access ends. The way out is never hidden.' },
  // SaaS / Workspace
  { name: 'InviteMembers', slug: 'invite-members', group: 'SaaS', section: 'Workspace', blurb: 'Paste a column of addresses, pick a role, see what it costs. Bad, duplicate and existing addresses are caught as chips before sending.' },
  { name: 'MemberList', slug: 'member-list', group: 'SaaS', section: 'Workspace', blurb: 'People, roles and removal, enforcing the rule most team screens forget: a workspace can never lose its last owner.' },
  { name: 'RolePermissions', slug: 'role-permissions', group: 'SaaS', section: 'Workspace', blurb: 'Roles against permissions as a checkbox matrix, every box named for its intersection, locked roles shown rather than hidden.' },
  { name: 'UserMenu', slug: 'user-menu', group: 'SaaS', section: 'Workspace', blurb: 'The account menu behind the avatar: identity above the menu rather than in it, settings, and a sign-out that is always last.' },
  { name: 'WorkspaceSwitcher', slug: 'workspace-switcher', group: 'SaaS', section: 'Workspace', blurb: 'The multi-tenant switcher: a listbox in a popover with arrow keys, a check on the current one, search past six, and Create.' },
  { name: 'AccessRequests', slug: 'access-requests', group: 'SaaS', section: 'Workspace', blurb: 'Pending join requests with the requester’s note. Change the role before approving, deny with a reason, or select several at once.' },
  // SaaS / Settings & developer
  { name: 'ApiKeyManager', slug: 'api-key-manager', group: 'SaaS', section: 'Settings & developer', blurb: 'Create, list and revoke keys. The secret is shown once in a dialog that cannot be dismissed by accident; the list shows prefix and last use.' },
  { name: 'ChangelogList', slug: 'changelog-list', group: 'SaaS', section: 'Settings & developer', blurb: 'Product updates as a changelog page or a compact “What’s new”, with anything newer than the last visit marked new.' },
  { name: 'DangerZone', slug: 'danger-zone', group: 'SaaS', section: 'Settings & developer', blurb: 'Irreversible actions fenced off, confirmed with type-to-confirm, with any failure kept on the row that caused it.' },
  { name: 'HelpPanel', slug: 'help-panel', group: 'SaaS', section: 'Settings & developer', blurb: 'Search the docs, jump to resources, check system status, and reach a person — offered right at a dead-end search.' },
  { name: 'IntegrationCard', slug: 'integration-card', group: 'SaaS', section: 'Settings & developer', blurb: 'One marketplace tile with exactly one next step per state — Connect, Configure, Reconnect or Upgrade — and a broken connection shown as broken.' },
  { name: 'SettingsSection', slug: 'settings-section', group: 'SaaS', section: 'Settings & developer', blurb: 'A settings block with its own save bar that knows when something changed, plus SettingsRow for the label-and-switch lines.' },
  { name: 'WebhookDeliveries', slug: 'webhook-deliveries', group: 'SaaS', section: 'Settings & developer', blurb: 'The delivery log: every row opens to the exact payload and response, timeouts are their own outcome, and failures retry in place.' },
  { name: 'WebhookEndpoints', slug: 'webhook-endpoints', group: 'SaaS', section: 'Settings & developer', blurb: 'Webhook endpoints with three states, not two: an enabled endpoint answering 500 is shown as failing, with its last response, on its own row.' },
  { name: 'NotificationPreferences', slug: 'notification-preferences', group: 'SaaS', section: 'Settings & developer', blurb: 'Events by channel as a grid of labelled checkboxes, an all box per channel with a mixed state, a digest frequency, and a draft held until you save.' },
  { name: 'FeatureFlags', slug: 'feature-flags', group: 'SaaS', section: 'Settings & developer', blurb: 'Flags with a switch per environment, a rollout slider, a stale marker and search. Turning one on in production asks first; turning it off never does.' },
  { name: 'DomainSetup', slug: 'domain-setup', group: 'SaaS', section: 'Settings & developer', blurb: 'Custom domain setup: DNS records to copy, a check result on each record, SSL status, and removal that asks first.' },
  { name: 'LocaleSettings', slug: 'locale-settings', group: 'SaaS', section: 'Settings & developer', blurb: 'Language, region, searchable time zone and format overrides, with a live preview line formatted through Intl and a draft saved on demand.' },
  // SaaS / Data & views
  { name: 'FilterBuilder', slug: 'filter-builder', group: 'SaaS', section: 'Data & views', blurb: 'Field, operator, value rows joined by all or any, with operators by type — plus matchesFilters, so table and builder agree on meaning.' },
  { name: 'SavedViews', slug: 'saved-views', group: 'SaaS', section: 'Data & views', blurb: 'Named filter sets above a table, with the unsaved state made explicit: save over it, save as new, or put it back.' },
  { name: 'DataExportPanel', slug: 'data-export-panel', group: 'SaaS', section: 'Data & views', blurb: 'Request an export by dataset, format and date range, then follow it from queued to ready, with download links and an expiry countdown.' },
  // SaaS / Engagement
  { name: 'AnnouncementBar', slug: 'announcement-bar', group: 'SaaS', section: 'Engagement', blurb: 'The strip across the top for a launch or maintenance, with dismissal remembered per announcement rather than globally.' },
  { name: 'CookieBanner', slug: 'cookie-banner', group: 'SaaS', section: 'Engagement', blurb: 'The first-visit consent prompt where Reject all is exactly as easy as Accept all. Opens ConsentManager for the detail.' },
  { name: 'FeedbackWidget', slug: 'feedback-widget', group: 'SaaS', section: 'Engagement', blurb: 'A face, a sentence and send. Either half is enough; the faces are real radios announced by their word.' },
  { name: 'ReferralCard', slug: 'referral-card', group: 'SaaS', section: 'Engagement', blurb: 'The offer first, then the invite link with copy and share, progress to the next reward in words, and each invited friend with their status.' },
  { name: 'NpsSurvey', slug: 'nps-survey', group: 'SaaS', section: 'Engagement', blurb: 'The 0–10 question as real radios, a follow-up that changes with the score, a thank-you state and dismiss — as a card or inline.' },
  // SaaS / Security
  { name: 'SessionList', slug: 'session-list', group: 'SaaS', section: 'Security', blurb: 'Where the account is signed in, with location and IP, the current device pinned, and sign-out of everything else.' },
  { name: 'SsoSetup', slug: 'sso-setup', group: 'SaaS', section: 'Security', blurb: 'SAML set up in real order — our values, theirs, test, enforce. Enforcement stays locked until a test passes against exactly the values on screen.' },
  { name: 'TwoFactorSetup', slug: 'two-factor-setup', group: 'SaaS', section: 'Security', blurb: 'Scan, confirm with a code, keep the recovery codes — Done stays locked until the codes are stored, because a lost phone is a locked account.' },
]

/**
 * The latest components, marked New across the site — the sidebar, the
 * catalogue, the component page header and the New filter. When the next set
 * lands it replaces this list, so New always means the most recent release.
 * Kept beside the catalogue rather than on each row, because the rows are
 * parsed by the metadata generator in one exact shape.
 */
export const NEW_COMPONENTS: ReadonlySet<string> = new Set([
  'Stack',
  'Container',
  'InfiniteScroll',
  'LanguageSwitcher',
  'VersionSwitcher',
  'ArticlePager',
  'DownloadButton',
  'LikeButton',
  'AnimatedList',
  'MarkerHighlight',
  'DateTimePicker',
  'DurationInput',
  'AddressInput',
  'TreeSelect',
  'CascadeSelect',
  'ColorSwatchPicker',
  'MarkdownEditor',
  'AvatarUpload',
  'RepeaterField',
  'SelectionToolbar',
  'EventCalendar',
  'AgendaList',
  'TreeTable',
  'EditableTable',
  'Leaderboard',
  'CodeTabs',
  'VideoPlayer',
  'AudioPlayer',
  'ImageAnnotator',
  'ResizableBox',
  'GanttChart',
  'MatrixHeatmap',
  'RadialBarChart',
  'SlopeChart',
  'ParetoChart',
  'DumbbellChart',
  'StepLoader',
  'UploadQueue',
  'ShimmerText',
  'GameOfLife',
  'KeyboardShortcutsDialog',
  'PromptDialog',
  'ReleaseNotesModal',
  'SeatSelector',
  'CancellationFlow',
  'DataExportPanel',
  'AccessRequests',
  'DomainSetup',
  'LocaleSettings',
  'MemoryGame',
])

export function isNewComponent(name: string): boolean {
  return NEW_COMPONENTS.has(name)
}

/** Lookups, built once. */
const bySlug = new Map(catalog.map((entry) => [entry.slug, entry]))
const byName = new Map(catalog.map((entry) => [entry.name, entry]))

export function findComponent(slug: string | undefined): CatalogEntry | undefined {
  return slug ? bySlug.get(slug) : undefined
}

/** Entries in one group, already in section order. */
export function componentsInGroup(group: GroupId): CatalogEntry[] {
  return catalog.filter((entry) => entry.group === group)
}

export function findComponentByName(name: string): CatalogEntry | undefined {
  return byName.get(name)
}

export const componentCount = catalog.length

/**
 * The count as marketing copy says it — "250+" rather than "254". Rounded down
 * to the ten, so it is never a claim the catalogue does not back, and it moves
 * on its own as components are added.
 */
export const componentCountRounded = `${Math.floor(componentCount / 10) * 10}+`
