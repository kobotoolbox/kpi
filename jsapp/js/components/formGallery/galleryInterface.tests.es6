import {
   galleryActions,
   galleryStore
} from './galleryInterface';

import {
  response_aaa,
  response_bbb
} from './galleryInterface.fixtures'

const mockResponse = (url, response, callback) => {
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
  beforeEach(() => {
    // only display error and warn logs
    $.mockjaxSettings.logging = 1;
  });

  afterEach(() => {
    chai.expect($.mockjax.unmockedAjaxCalls().length).to.equal(0);
    $.mockjax.clear();
  });

  describe('setFormUid action', () => {
    it('should load new data', (done) => {
      galleryActions.setFormUid(null);
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
      chai.expect(galleryStore.state.galleries.length).to.equal(0);

      mockResponse(
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
    });
  });

  describe('building gallery data', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_aaa, done);
      galleryActions.setFormUid('aaa');
    });

    it('should produce proper gallery title and date', () => {
      chai.expect(galleryStore.state.galleries[0].title).to.equal('Your face');
      chai.expect(galleryStore.state.galleries[0].date).to.equal('October 3, 2018 12:45 PM');
    });

    it('should produce proper media labels and date', () => {
      chai.expect(galleryStore.state.galleries[0].findMedia(0).submissionLabel).to.equal('Record 1');
      chai.expect(galleryStore.state.galleries[0].findMedia(0).questionLabel).to.equal('Your face');
      chai.expect(galleryStore.state.galleries[0].findMedia(0).date).to.equal('October 3, 2018 12:45 PM');
    });
  });

  describe('openMediaModal action', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_aaa, done);
      galleryActions.setFormUid('aaa');
    });

    it('should select media', () => {
      chai.expect(false).to.equal(true);
    });
  });

  describe('selectGalleryMedia action', () => {
    it('should produce new SelectedMedia', () => {
      chai.expect(false).to.equal(true);
    });
    it('should prouduce pending SelectedMedia if not present in loaded data', () => {
      chai.expect(false).to.equal(true);
    });
    it('should load more galleries if selected gallery not loaded', () => {
      chai.expect(false).to.equal(true);
    });
    it('should load more gallery medias if selected media not loaded', () => {
      chai.expect(false).to.equal(true);
    });
  });

  describe('selectPreviousGalleryMedia action', () => {
    it('should select last media from previous gallery if on first media', () => {
      chai.expect(false).to.equal(true);
    });
    it('should select previous media', () => {
      chai.expect(false).to.equal(true);
    });
  });

  describe('selectNextGalleryMedia action', () => {
    it('should select first media from next gallery if on last media', () => {
      chai.expect(false).to.equal(true);
    });
    it('should select next media', () => {
      chai.expect(false).to.equal(true);
    });
  });

  describe('setFilters action', () => {
    it('should wipe and load new data when filterGroupBy changes', () => {
      chai.expect(false).to.equal(true);
    });
    it('should wipe and load new data when filterOrder changes', () => {
      chai.expect(false).to.equal(true);
    });
    it('should wipe and load new data when filterAllVersions changes', () => {
      chai.expect(false).to.equal(true);
    });
    it('should update filtered galleries when filterQuery changes', () => {
      chai.expect(false).to.equal(true);
    });
  });

  describe('loadMoreGalleries action', () => {
    it('should throw if no more galleries to load', () => {
      chai.expect(false).to.equal(true);
    });
  });

  describe('loadMoreGalleryMedias action', () => {
    it('should throw if no more medias to load', () => {
      chai.expect(false).to.equal(true);
    });
  });
});
