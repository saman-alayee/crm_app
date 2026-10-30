import { SITE_NAME, SITE_DESCRIPTION } from '~/constants/site';

type PageSeoInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function absolutize(siteUrl: string, value?: string | null) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  if (!value) return `${base}/logo.png`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${base}${value.startsWith('/') ? value : `/${value}`}`;
}

export function usePageSeo(input: MaybeRefOrGetter<PageSeoInput>) {
  const config = useRuntimeConfig();
  const route = useRoute();

  const resolved = computed(() => toValue(input));

  const title = computed(() => {
    const t = resolved.value.title?.trim();
    return t ? `${t} | ${SITE_NAME}` : SITE_NAME;
  });

  const description = computed(() => resolved.value.description?.trim() || SITE_DESCRIPTION);

  const canonicalPath = computed(() => resolved.value.path ?? route.path);

  const canonicalUrl = computed(
    () => `${String(config.public.siteUrl || '').replace(/\/+$/, '')}${canonicalPath.value}`
  );

  const imageUrl = computed(() => absolutize(String(config.public.siteUrl || ''), resolved.value.image));

  useSeoMeta({
    title: () => title.value,
    description: () => description.value,
    ogTitle: () => title.value,
    ogDescription: () => description.value,
    ogType: 'website',
    ogLocale: 'fa_IR',
    ogUrl: () => canonicalUrl.value,
    ogImage: () => imageUrl.value,
    twitterCard: 'summary_large_image',
    twitterTitle: () => title.value,
    twitterDescription: () => description.value,
    twitterImage: () => imageUrl.value,
    robots: () => (resolved.value.noindex ? 'noindex, nofollow' : 'index, follow'),
  });

  useHead(() => ({
    link: [
      {
        rel: 'canonical',
        href: canonicalUrl.value,
      },
    ],
    script: resolved.value.jsonLd
      ? [
          {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(resolved.value.jsonLd),
          },
        ]
      : [],
  }));
}
