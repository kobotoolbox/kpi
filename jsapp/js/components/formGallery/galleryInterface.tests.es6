import {
   galleryActions,
   galleryStore
} from './galleryInterface';

const response_aaa = {
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
        filename: 'kobo/attachments/photo.jpg',
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
        download_url: 'api/media/kobo/attachments/photo.jpg',
        small_download_url: 'api/assets/aaa/attachments/1?filename=kobo/attachments/photo.jpg&size=small',
        medium_download_url: 'api/assets/aaa/attachments/1?filename=kobo/attachments/photo.jpg&size=medium',
        large_download_url: 'api/assets/aaa/attachments/1?filename=kobo/attachments/photo.jpg&size=large'
      }]
    }
  }]
};

const mockCall = (url, response, callback) => {
  $.mockjax({
    url: url,
    type: 'get',
    responseText: response,
    onAfterSuccess: () => {
      setTimeout(() => {
        callback();
      }, 0);
    }
  });
};

describe('galleryInterface', () => {
  describe('setFormUid action', () => {
    it('should load data when set', (done) => {
      galleryActions.setFormUid(null);
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);

      mockCall(
        '/assets/aaa/attachments',
        response_aaa,
        () => {
          chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
          chai.expect(galleryStore.state.galleries.length).to.equal(1);
          done();
        }
      );
      galleryActions.setFormUid('aaa');
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(true);

      chai.expect($.mockjax.unmockedAjaxCalls().length).to.equal(0);
    });
  });
});
