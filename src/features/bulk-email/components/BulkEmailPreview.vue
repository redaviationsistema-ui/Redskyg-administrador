<script setup>
import { computed } from "vue";
import {
  DEFAULT_BULK_EMAIL_BUTTON_TEXT,
  DEFAULT_BULK_EMAIL_BUTTON_URL,
  DEFAULT_BULK_EMAIL_CONTENT_HTML,
  DEFAULT_BULK_EMAIL_SENDER_EMAIL,
  DEFAULT_BULK_EMAIL_SENDER_NAME,
  DEFAULT_BULK_EMAIL_TITLE,
} from "../utils/bulkEmailTemplate";

const props = defineProps({
  values: {
    type: Object,
    required: true,
  },
  imagePreviewUrl: {
    type: String,
    default: "",
  },
});

const previewTitle = computed(() => props.values.main_title || props.values.subject || DEFAULT_BULK_EMAIL_TITLE);
const previewSenderName = computed(() => props.values.sender_name || DEFAULT_BULK_EMAIL_SENDER_NAME);
const previewSenderEmail = computed(() => props.values.sender_email || DEFAULT_BULK_EMAIL_SENDER_EMAIL);
const previewButtonText = computed(() => props.values.button_text || DEFAULT_BULK_EMAIL_BUTTON_TEXT);
const previewButtonUrl = computed(() => props.values.button_url || DEFAULT_BULK_EMAIL_BUTTON_URL);
const previewContentHtml = computed(() => props.values.content_html || DEFAULT_BULK_EMAIL_CONTENT_HTML);
</script>

<template>
  <section class="preview-card">
    <header class="preview-head">
      <div>
        <span class="eyebrow">Vista previa</span>
        <h3>{{ previewTitle }}</h3>
      </div>
      <div class="sender-chip">
        <strong>{{ previewSenderName }}</strong>
        <span>{{ previewSenderEmail }}</span>
      </div>
    </header>

    <div class="preview-body email-shell">
      <div class="email-canvas">
        <img v-if="imagePreviewUrl" :src="imagePreviewUrl" alt="Imagen principal" class="hero-image" />

        <div class="logo-wrap">
          <img src="https://redskyg.com/administrador/images/logoo.png" alt="Sky Group" class="brand-logo" />
        </div>

        <article class="preview-copy">
          <p class="greeting">Dear Sir/Madam,</p>
          <h4>{{ previewTitle }}</h4>
          <div class="content-html" v-html="previewContentHtml"></div>

          <a :href="previewButtonUrl" class="cta-link" target="_blank" rel="noreferrer">
            {{ previewButtonText }}
          </a>

          <p class="signature">
            Yours sincerely,<br /><br />
            <strong>Sky Group</strong><br />
            The Green, Ste R, Dover<br />
            Delaware 19901, USA<br />
            Email:
            <a href="mailto:Sales@redskyg.com">Sales@redskyg.com</a><br />
            Phone: +52 722 112 6671
          </p>

          <div class="links-block">
            <strong>Explore Sky Group</strong><br /><br />
            Website:<br />
            <a href="https://redskyg.com/" target="_blank" rel="noreferrer">https://redskyg.com/</a><br /><br />
            Request a Quotation:<br />
            <a href="https://redskyg.com/landing" target="_blank" rel="noreferrer">https://redskyg.com/landing</a><br /><br />
            Instagram:<br />
            <a href="https://www.instagram.com/redaviationcompany" target="_blank" rel="noreferrer">@redaviationcompany</a><br /><br />
            TikTok:<br />
            <a href="https://www.tiktok.com/@redaviationcompany" target="_blank" rel="noreferrer">@redaviationcompany</a>
          </div>
        </article>

        <footer class="preview-footer">
          This message may contain confidential business information intended for the recipient.
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview-card {
  display: grid;
  gap: 18px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-sm);
}

.preview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.preview-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.sender-chip {
  min-width: 200px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--bg-soft);
}

.sender-chip strong,
.sender-chip span {
  display: block;
}

.sender-chip span {
  color: var(--text-muted);
  font-size: 0.84rem;
}

.preview-body {
  display: block;
}

.email-shell {
  padding: 10px;
  border-radius: 22px;
  background: #f4f6f8;
}

.email-canvas {
  overflow: hidden;
  border-radius: 18px;
  background: #ffffff;
}

.hero-image {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  display: block;
}

.logo-wrap {
  padding: 28px 24px 8px;
  display: flex;
  justify-content: center;
}

.brand-logo {
  width: 180px;
  max-width: 100%;
  height: auto;
}

.preview-copy {
  display: grid;
  gap: 18px;
  padding: 18px 24px 28px;
  color: #444444;
  line-height: 1.8;
}

.preview-copy h4,
.preview-copy p,
.content-html :deep(p) {
  margin: 0;
}

.preview-copy h4 {
  color: #10233f;
  font-size: 1.55rem;
  line-height: 1.3;
}

.greeting,
.signature,
.links-block,
.content-html {
  font-size: 0.95rem;
}

.content-html {
  color: #444444;
}

.content-html :deep(p + p) {
  margin-top: 14px;
}

.cta-link {
  display: inline-flex;
  width: fit-content;
  padding: 14px 24px;
  border-radius: 8px;
  background: #0a58ca;
  color: white;
  font-weight: 700;
}

.signature a,
.links-block a {
  color: #0a58ca;
  text-decoration: none;
}

.links-block {
  padding-top: 22px;
  border-top: 1px solid #eeeeee;
  color: #222222;
}

.preview-footer {
  padding: 20px 24px;
  background: #edf3f9;
  color: #888888;
  font-size: 0.78rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .preview-head {
    flex-direction: column;
  }

  .sender-chip {
    width: 100%;
    min-width: 0;
  }
}
</style>
