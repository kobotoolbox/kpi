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
          background: '#1e2129', // $kobo-gray-14
          color: '#fff', // $kobo-white
          maxHeight: '90vh',
          overflow: 'hidden',
        },
        success: {
          iconTheme: {
            primary: '#96eb9e', // $kobo-green
            secondary: '#1e2129', // $kobo-gray-14
          },
        },
        error: {
          iconTheme: {
            primary: '#fe6b7d', // $kobo-red
            secondary: '#1e2129', // $kobo-gray-14
          },
        },
        loading: {
          iconTheme: {
            primary: '#979fb4', // $kobo-gray-65
            secondary: '#1e2129', // $kobo-gray-14
          },
        },
        duration: 5000, // 5 seconds
      }}
    />
  );
}
