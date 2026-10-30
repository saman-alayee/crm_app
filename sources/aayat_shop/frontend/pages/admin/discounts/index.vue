<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
await navigateTo('/admin/coupons', { replace: true });
</script>
