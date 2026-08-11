<script setup>
import { computed, onMounted, ref } from "vue";
import { listPublicVillas } from "../services/experienceGallery.service";

const villas = ref([]);
const loading = ref(true);
const errorMessage = ref("");
const logoUrl = `${import.meta.env.BASE_URL}images/logoo.png`;
const heroVilla = computed(() => villas.value.find((villa) => villa.cover_url) || villas.value[0]);
const heroStyle = computed(() => heroVilla.value?.cover_url ? { backgroundImage: `url("${heroVilla.value.cover_url}")` } : {});

async function load() {
  try { villas.value = await listPublicVillas(); }
  catch (error) { errorMessage.value = error.message || "No fue posible cargar las experiencias."; }
  finally { loading.value = false; }
}

function scrollToVillas() { document.querySelector("#villas")?.scrollIntoView({ behavior: "smooth" }); }

onMounted(load);
</script>

<template>
  <main class="public-page">
    <section class="hero" :style="heroStyle">
      <div class="shade" />
      <nav class="public-nav" aria-label="Navegación principal">
        <div class="nav-side"><a href="#">Inicio</a><a href="#" class="quote">Cotizar vuelo</a><a href="#">Flota</a><a class="current" href="#villas">Experiencias</a></div>
        <img :src="logoUrl" alt="Sky Group" class="logo" />
        <div class="nav-side right"><a href="#contacto">Contacto</a><button class="language active">ES</button><button class="language">EN</button></div>
      </nav>
      <div class="hero-copy">
        <p class="overline">Sotavento Villas · Sky Group</p>
        <h1>Residencias privadas<br>en los destinos más<br>exclusivos de México</h1>
        <p class="intro">Descubre una colección cuidadosamente seleccionada de villas, residencias frente al mar y propiedades de lujo. Complementa tu vuelo privado con concierge, chef privado y experiencias personalizadas.</p>
        <div class="hero-actions"><button class="primary" @click="scrollToVillas">Explorar villas <span>↓</span></button><a href="#contacto">Hablar con un concierge</a></div>
      </div>
      <button class="whatsapp" aria-label="Contactar por WhatsApp">✆</button>
    </section>

    <section id="villas" class="villas-section">
      <header><p class="overline">Colección privada</p><h2>Villas seleccionadas</h2><p>Espacios excepcionales para vivir México con privacidad, comodidad y un servicio impecable.</p></header>
      <div v-if="loading" class="public-grid"><article v-for="n in 4" :key="n" class="villa-public skeleton" /></div>
      <p v-else-if="errorMessage" class="message">{{ errorMessage }}</p>
      <div v-else-if="villas.length" class="public-grid">
        <article v-for="villa in villas" :key="villa.id" class="villa-public">
          <div class="villa-photo"><img v-if="villa.cover_url" :src="villa.cover_url" :alt="villa.name" loading="lazy"><span v-else>Sky Group Villas</span><small>{{ villa.image_count }} fotografías</small></div>
          <div class="villa-copy"><p>{{ villa.destination }}</p><h3>{{ villa.name }}</h3><button>Descubrir villa <span>→</span></button></div>
        </article>
      </div>
      <p v-else class="message">Próximamente encontrarás aquí nuestra colección de villas.</p>
    </section>

    <footer id="contacto"><img :src="logoUrl" alt="Sky Group"><p>Vuelos privados y residencias extraordinarias.</p></footer>
  </main>
</template>

<style scoped>
.public-page{min-height:100vh;background:#f4f0e8;color:#172d37;font-family:"Segoe UI",sans-serif}.hero{position:relative;min-height:100vh;background:#173947 center/cover no-repeat;isolation:isolate}.shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(5,27,39,.78) 0%,rgba(8,31,43,.48) 53%,rgba(4,22,32,.34)),linear-gradient(180deg,rgba(5,28,41,.64),transparent 24%,rgba(4,20,29,.52))}.public-nav{width:min(1240px,calc(100% - 48px));margin:auto;padding:34px 0 18px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid rgba(255,255,255,.18);color:#fff}.nav-side{display:flex;align-items:center;gap:24px}.nav-side.right{justify-content:flex-end}.public-nav a,.language{color:#fff;background:none;font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.public-nav .current{color:#d7ad55}.quote{padding:12px 18px;border:1px solid rgba(215,173,85,.45);border-radius:999px}.logo{width:130px;max-height:54px;object-fit:contain;filter:brightness(0) invert(1)}.language{width:34px;height:34px;border:1px solid rgba(255,255,255,.25);border-radius:50%}.language.active{border-color:#d7ad55;color:#d7ad55}.hero-copy{width:min(1240px,calc(100% - 48px));margin:0 auto;padding:22vh 0 12vh;color:#fff}.overline{margin:0 0 16px;color:#d7ad55;font-size:.72rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.hero-copy h1{max-width:790px;margin:0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(3.2rem,6vw,6.4rem);font-weight:400;line-height:.9;letter-spacing:-.045em}.intro{max-width:620px;margin:28px 0;color:rgba(255,255,255,.82);font-size:1rem;line-height:1.75}.hero-actions{display:flex;gap:12px;align-items:center}.hero-actions button,.hero-actions a{min-height:50px;padding:0 24px;border-radius:999px;font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.hero-actions .primary{display:flex;gap:18px;align-items:center;background:#d7ad55;color:#172d37;cursor:pointer}.hero-actions a{display:flex;align-items:center;border:1px solid rgba(255,255,255,.45);color:#fff}.whatsapp{position:absolute;right:28px;bottom:28px;width:58px;height:58px;border-radius:50%;background:#23cf68;color:#fff;font-size:1.8rem}.villas-section{padding:110px max(24px,calc((100% - 1240px)/2))}.villas-section>header{max-width:660px;margin-bottom:46px}.villas-section h2{margin:0;font-family:Georgia,serif;font-size:clamp(2.5rem,5vw,4.5rem);font-weight:400}.villas-section header>p:last-child{color:#647178;line-height:1.7}.public-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.villa-public{overflow:hidden;background:#fff;box-shadow:0 18px 50px rgba(20,40,48,.09)}.villa-photo{position:relative;display:grid;place-items:center;height:320px;background:#173947;color:#fff}.villa-photo img{width:100%;height:100%;object-fit:cover}.villa-photo small{position:absolute;right:14px;bottom:14px;padding:7px 10px;background:rgba(4,24,34,.75);font-size:.68rem}.villa-copy{padding:22px}.villa-copy p{margin:0;color:#b38a3d;font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.villa-copy h3{margin:8px 0 24px;font-family:Georgia,serif;font-size:1.7rem;font-weight:400}.villa-copy button{display:flex;justify-content:space-between;width:100%;padding:12px 0;border-top:1px solid #ddd;background:none;color:#173947;font-size:.72rem;font-weight:800;text-transform:uppercase}.skeleton{height:430px;background:linear-gradient(90deg,#e6e0d7,#f6f2eb,#e6e0d7);background-size:200%;animation:pulse 1.2s infinite}.message{text-align:center;color:#647178}footer{display:flex;align-items:center;justify-content:space-between;padding:38px max(24px,calc((100% - 1240px)/2));background:#102d39;color:#fff}footer img{width:120px;filter:brightness(0) invert(1)}@keyframes pulse{to{background-position:-200%}}@media(max-width:1050px){.public-grid{grid-template-columns:repeat(2,1fr)}.public-nav{grid-template-columns:1fr auto}.public-nav>.nav-side:first-child{display:none}.logo{grid-column:1}.nav-side.right{grid-column:2}}@media(max-width:650px){.public-nav{width:calc(100% - 30px)}.nav-side.right>a,.language{display:none}.hero-copy{width:calc(100% - 36px);padding-top:20vh}.hero-copy h1{font-size:clamp(3rem,15vw,4.6rem)}.intro{font-size:.9rem}.hero-actions{align-items:stretch;flex-direction:column}.hero-actions>*{justify-content:center;width:100%}.villas-section{padding-top:72px}.public-grid{grid-template-columns:1fr}.villa-photo{height:380px}footer{align-items:flex-start;flex-direction:column;gap:16px}}
</style>
