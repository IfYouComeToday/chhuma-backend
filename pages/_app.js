// pages/_app.js
import { useEffect } from 'react';
import { Router } from 'next/router';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Initialize PostHog
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      // Enable debug mode in development
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug();
      }
    });

    // Track page views
    const handleRouteChange = () => posthog?.capture('$pageview');
    
    // Add route change listeners
    Router.events.on('routeChangeComplete', handleRouteChange);
    
    // Clean up on unmount
    return () => {
      Router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <Component {...pageProps} />
    </PostHogProvider>
  );
}

export default MyApp;