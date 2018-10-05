// 1 gallery with 1 image
export const response_aaa = {
  count: 1,
  attachments_count: 1,
  results: [{
    index: 0,
    number: 3,
    type: 'image',
    name: 'Your_face',
    label: 'Your face',
    url: 'api/assets/aaa/attachments/',
    attachments: {
      count: 1,
      next: null,
      next_page: null,
      previous: null,
      previous_page: null,
      results: [{
        url: 'api/assets/aaa/attachments/1/',
        filename: 'tester/attachments/photo.jpg',
        short_filename: 'photo.jpg',
        mimetype: 'image/jpeg',
        id: 1,
        submission: {
          instance_uuid: 'qwerty1',
          username: 'tester',
          xform_id: 'aaa',
          date_modified: '2018-10-03T10:45:22.902Z',
          status: 'submitted_via_web',
          date_created: '2018-10-03T10:45:22.902Z',
          id: 36
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Your face',
          type: 'image',
          name: 'Your_face',
          number: 3
        },
        download_url: 'api/media/tester/attachments/photo.jpg',
        small_download_url: 'api/assets/aaa/attachments/1?filename=tester/attachments/photo.jpg&size=small',
        medium_download_url: 'api/assets/aaa/attachments/1?filename=tester/attachments/photo.jpg&size=medium',
        large_download_url: 'api/assets/aaa/attachments/1?filename=tester/attachments/photo.jpg&size=large'
      }]
    }
  }]
};

// 2 galleries with 1 and 5 images
export const response_bbb = {
  count: 2,
  attachments_count: 6,
  results: [{
    index: 0,
    number: 3,
    type: 'image',
    name: 'Their_head',
    label: 'Their head',
    url: 'api/assets/bbb/attachments/?all=false&group_by=question&index=0&sort=asc&type=image',
    attachments: {
      count: 1,
      next: null,
      next_page: null,
      previous: null,
      previous_page: null,
      results: [{
        url: 'api/assets/bbb/attachments/2/',
        filename: 'tester/attachments/cats.jpg',
        short_filename: 'cats.jpg',
        mimetype: 'image/jpeg',
        id: 2,
        submission: {
          instance_uuid: '45df36bc-ca0d-4a2a-95aa-ed026d58319e',
          username: 'tester',
          xform_id: 'bbb',
          date_modified: '2018-10-05T14:37:32.146Z',
          status: 'submitted_via_web',
          date_created: '2018-10-05T14:37:32.145Z',
          id: 38
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Their head',
          type: 'image',
          name: 'Their_head',
          number: 3
        },
        download_url: 'api/media/tester/attachments/cats.jpg',
        small_download_url: 'api/assets/bbb/attachments/2?filename=tester/attachments/cats.jpg&size=small',
        medium_download_url: 'api/assets/bbb/attachments/2?filename=tester/attachments/cats.jpg&size=medium',
        large_download_url: 'api/assets/bbb/attachments/2?filename=tester/attachments/cats.jpg&size=large'
      }]
    }
  }, {
    index: 1,
    number: 4,
    type: 'image',
    name: 'Their_fingers',
    label: 'Their fingers',
    url: 'api/assets/bbb/attachments/?all=false&group_by=question&index=1&sort=asc&type=image',
    attachments: {
      count: 5,
      next: null,
      next_page: null,
      previous: null,
      previous_page: null,
      results: [{
        url: 'api/assets/bbb/attachments/3/',
        filename: 'tester/attachments/dolphins.jpg',
        short_filename: 'dolphins.jpg',
        mimetype: 'image/jpeg',
        id: 3,
        submission: {
          instance_uuid: '45df36bc-ca0d-4a2a-95aa-ed026d58319e',
          username: 'tester',
          xform_id: 'bbb',
          date_modified: '2018-10-05T14:37:32.146Z',
          status: 'submitted_via_web',
          date_created: '2018-10-05T14:37:32.145Z',
          id: 38
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Their fingers',
          type: 'image',
          name: 'Their_fingers',
          number: 4
        },
        download_url: 'api/media/tester/attachments/dolphins.jpg',
        small_download_url: 'api/assets/bbb/attachments/3?filename=tester/attachments/dolphins.jpg&size=small',
        medium_download_url: 'api/assets/bbb/attachments/3?filename=tester/attachments/dolphins.jpg&size=medium',
        large_download_url: 'api/assets/bbb/attachments/3?filename=tester/attachments/dolphins.jpg&size=large'
      }, {
        url: 'api/assets/bbb/attachments/4/',
        filename: 'tester/attachments/zebra.jpg',
        short_filename: 'zebra.jpg',
        mimetype: 'image/jpeg',
        id: 4,
        submission: {
          instance_uuid: 'c0f8b868-1343-4b84-9c37-7a672b2fc030',
          username: 'tester',
          xform_id: 'bbb',
          date_modified: '2018-10-05T14:37:40.126Z',
          status: 'submitted_via_web',
          date_created: '2018-10-05T14:37:40.126Z',
          id: 39
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Their fingers',
          type: 'image',
          name: 'Their_fingers',
          number: 4
        },
        download_url: 'api/media/tester/attachments/zebra.jpg',
        small_download_url: 'api/assets/bbb/attachments/4?filename=tester/attachments/zebra.jpg&size=small',
        medium_download_url: 'api/assets/bbb/attachments/4?filename=tester/attachments/zebra.jpg&size=medium',
        large_download_url: 'api/assets/bbb/attachments/4?filename=tester/attachments/zebra.jpg&size=large'
      }, {
        url: 'api/assets/bbb/attachments/5/',
        filename: 'tester/attachments/dog.jpg',
        short_filename: 'dog.jpg',
        mimetype: 'image/jpeg',
        id: 5,
        submission: {
          instance_uuid: '63c2757f-c658-4c45-bb6f-0683b877b320',
          username: 'tester',
          xform_id: 'bbb',
          date_modified: '2018-10-05T14:37:46.053Z',
          status: 'submitted_via_web',
          date_created: '2018-10-05T14:37:46.053Z',
          id: 40
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Their fingers',
          type: 'image',
          name: 'Their_fingers',
          number: 4
        },
        download_url: 'api/media/tester/attachments/dog.jpg',
        small_download_url: 'api/assets/bbb/attachments/5?filename=tester/attachments/dog.jpg&size=small',
        medium_download_url: 'api/assets/bbb/attachments/5?filename=tester/attachments/dog.jpg&size=medium',
        large_download_url: 'api/assets/bbb/attachments/5?filename=tester/attachments/dog.jpg&size=large'
      }, {
        url: 'api/assets/bbb/attachments/6/',
        filename: 'tester/attachments/earthling.jpg',
        short_filename: 'earthling.jpg',
        mimetype: 'image/jpeg',
        id: 6,
        submission: {
          instance_uuid: '952fb03d-f333-4476-b96c-0e98b8b42889',
          username: 'tester',
          xform_id: 'bbb',
          date_modified: '2018-10-05T14:37:53.345Z',
          status: 'submitted_via_web',
          date_created: '2018-10-05T14:37:53.345Z',
          id: 41
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Their fingers',
          type: 'image',
          name: 'Their_fingers',
          number: 4
        },
        download_url: 'api/media/tester/attachments/earthling.jpg',
        small_download_url: 'api/assets/bbb/attachments/6?filename=tester/attachments/earthling.jpg&size=small',
        medium_download_url: 'api/assets/bbb/attachments/6?filename=tester/attachments/earthling.jpg&size=medium',
        large_download_url: 'api/assets/bbb/attachments/6?filename=tester/attachments/earthling.jpg&size=large'
      }, {
        url: 'api/assets/bbb/attachments/7/',
        filename: 'tester/attachments/thunderbolt.jpg',
        short_filename: 'thunderbolt.jpg',
        mimetype: 'image/jpeg',
        id: 7,
        submission: {
          instance_uuid: 'c971b647-f6d7-4aec-af00-ab1cca6187a0',
          username: 'tester',
          xform_id: 'bbb',
          date_modified: '2018-10-05T14:37:59.285Z',
          status: 'submitted_via_web',
          date_created: '2018-10-05T14:37:59.285Z',
          id: 42
        },
        can_view_submission: true,
        question: {
          in_latest_version: true,
          label: 'Their fingers',
          type: 'image',
          name: 'Their_fingers',
          number: 4
        },
        download_url: 'api/media/tester/attachments/thunderbolt.jpg',
        small_download_url: 'api/assets/bbb/attachments/7?filename=tester/attachments/thunderbolt.jpg&size=small',
        medium_download_url: 'api/assets/bbb/attachments/7?filename=tester/attachments/thunderbolt.jpg&size=medium',
        large_download_url: 'api/assets/bbb/attachments/7?filename=tester/attachments/thunderbolt.jpg&size=large'
      }]
    }
  }]
};
