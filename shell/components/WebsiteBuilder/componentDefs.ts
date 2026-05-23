import type { WebsiteComponentType } from '@coaching/sdk';

export interface EditField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'color';
  placeholder?: string;
}

export interface ComponentDefinition {
  type: WebsiteComponentType;
  label: string;
  icon: string;           // SVG path data
  defaultSize: { w: number; h: number };
  defaultProps: Record<string, string>;
  editFields: EditField[];
}

export const COMPONENT_DEFS: ComponentDefinition[] = [
  {
    type: 'hero',
    label: 'Hero / Banner',
    icon: 'M3 3h18v6H3zM3 15h18v6H3z',
    defaultSize: { w: 680, h: 240 },
    defaultProps: {
      heading: 'Your Name',
      subheading: 'Helping you unlock your potential',
      ctaText: 'Book a Free Call',
      ctaUrl: '',
      bgColor: '',
    },
    editFields: [
      { key: 'heading',    label: 'Heading',     type: 'text',     placeholder: 'Your headline' },
      { key: 'subheading', label: 'Sub-heading', type: 'textarea', placeholder: 'A short description' },
      { key: 'ctaText',    label: 'Button Text', type: 'text',     placeholder: 'Book a Free Call' },
      { key: 'ctaUrl',     label: 'Button URL',  type: 'url',      placeholder: 'https://...' },
    ],
  },
  {
    type: 'ribbon',
    label: 'Announcement Ribbon',
    icon: 'M5 9h14M5 15h14',
    defaultSize: { w: 680, h: 56 },
    defaultProps: { text: '🎉 New program launching soon — spots are limited!', bgColor: '#fef08a', textColor: '#78350f' },
    editFields: [
      { key: 'text',      label: 'Message',          type: 'text',  placeholder: 'Announcement text' },
      { key: 'bgColor',   label: 'Background Color', type: 'color' },
      { key: 'textColor', label: 'Text Color',       type: 'color' },
    ],
  },
  {
    type: 'cta_button',
    label: 'CTA Button',
    icon: 'M12 4.5v15m7.5-7.5h-15',
    defaultSize: { w: 260, h: 64 },
    defaultProps: { text: 'Get Started Today', url: '', bgColor: '', textColor: '' },
    editFields: [
      { key: 'text',      label: 'Button Text',      type: 'text', placeholder: 'Get Started Today' },
      { key: 'url',       label: 'Link URL',         type: 'url',  placeholder: 'https://...' },
      { key: 'bgColor',   label: 'Background Color', type: 'color' },
      { key: 'textColor', label: 'Text Color',       type: 'color' },
    ],
  },
  {
    type: 'testimonial',
    label: 'Testimonial',
    icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
    defaultSize: { w: 380, h: 160 },
    defaultProps: { quote: 'This coaching program changed my life completely.', name: 'Jane D.', title: 'Entrepreneur' },
    editFields: [
      { key: 'quote', label: 'Quote',       type: 'textarea', placeholder: 'Client testimonial...' },
      { key: 'name',  label: 'Client Name', type: 'text',     placeholder: 'Jane D.' },
      { key: 'title', label: 'Title / Role',type: 'text',     placeholder: 'Entrepreneur' },
    ],
  },
  {
    type: 'feature_block',
    label: 'Feature Block',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    defaultSize: { w: 300, h: 140 },
    defaultProps: { icon: '⚡', heading: 'Fast Results', body: 'See measurable progress within weeks.' },
    editFields: [
      { key: 'icon',    label: 'Icon / Emoji', type: 'text',     placeholder: '⚡' },
      { key: 'heading', label: 'Heading',      type: 'text',     placeholder: 'Feature title' },
      { key: 'body',    label: 'Description',  type: 'textarea', placeholder: 'Short description...' },
    ],
  },
  {
    type: 'image_text',
    label: 'Image + Text',
    icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    defaultSize: { w: 520, h: 200 },
    defaultProps: { imageUrl: '', imageAlt: 'Image', heading: 'About My Approach', body: 'Describe your coaching philosophy and unique approach here.', layout: 'left' },
    editFields: [
      { key: 'imageUrl', label: 'Image URL',   type: 'url',      placeholder: 'https://...' },
      { key: 'imageAlt', label: 'Image Alt',   type: 'text',     placeholder: 'Description of image' },
      { key: 'heading',  label: 'Heading',     type: 'text',     placeholder: 'Section heading' },
      { key: 'body',     label: 'Body Text',   type: 'textarea', placeholder: 'Your text here...' },
    ],
  },
  {
    type: 'custom_html',
    label: 'Custom HTML / Embed',
    icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
    defaultSize: { w: 520, h: 160 },
    defaultProps: { html: '<p>Paste custom HTML or embed code here.</p>' },
    editFields: [
      { key: 'html', label: 'HTML / Embed', type: 'textarea', placeholder: '<div>...</div>' },
    ],
  },
];

export function getComponentDef(type: WebsiteComponentType): ComponentDefinition {
  return COMPONENT_DEFS.find(d => d.type === type) ?? COMPONENT_DEFS[0];
}
