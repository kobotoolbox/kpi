import React from 'react';
import {Toaster} from 'react-hot-toast';

export default function ToasterConfig() {
  // Default position of all notifications, page specific ones can be overwritten
  return (
    <Toaster
      toastOptions={{
        // TODO: get colours from a single file: https://github.com/kobotoolbox/kobo-common/issues/1
        style: {
          borderRadius: '6px',
          padding: '16px',
          background: '#1e2129', // $kobo-gray-900
          color: '#fff', // $kobo-white
          maxHeight: '90vh',
          overflow: 'hidden',
        },
        success: {
          iconTheme: {
            primary: '#96eb9e', // $kobo-green
            secondary: '#1e2129', // $kobo-gray-900
          },
        },
        error: {
          iconTheme: {
            primary: '#ff8080', // $kobo-mid-red
            secondary: '#1e2129', // $kobo-gray-900
          },
        },
        loading: {
          iconTheme: {
            primary: '#979fb4', // $kobo-gray-500
            secondary: '#1e2129', // $kobo-gray-900
          },
        },
        duration: 5000, // 5 seconds
      }}
    />
  );
}
