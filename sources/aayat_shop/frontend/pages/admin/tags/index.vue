<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
await navigateTo('/admin/products', { replace: true });
</script>
