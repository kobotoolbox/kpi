import {
   galleryActions,
   galleryStore,
   GROUPBY_OPTIONS,
   ORDER_OPTIONS
} from './galleryInterface';

import {
  response_1_1,
  response_1_1_next,
  response_2_6
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
    galleryStore.resetStateToInitial();
  });

  describe('setFormUid action', () => {
    it('should load new data', (done) => {
      galleryActions.setFormUid(null);
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
      chai.expect(galleryStore.state.galleries.length).to.equal(0);

      mockResponse(
        '/assets/aaa/attachments',
        response_1_1,
        () => {
          chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
          chai.expect(galleryStore.state.galleries[0].title).to.equal('Your face');
          chai.expect(galleryStore.state.galleries.length).to.equal(1);

          mockResponse(
            '/assets/bbb/attachments',
            response_2_6,
            () => {
              chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
              chai.expect(galleryStore.state.galleries[0].title).to.equal('Their head');
              chai.expect(galleryStore.state.galleries.length).to.equal(2);
              done();
            }
          );
          galleryActions.setFormUid('bbb');
          chai.expect(galleryStore.state.isLoadingGalleries).to.equal(true);
          chai.expect(galleryStore.state.galleries.length).to.equal(0);
        }
      );
      galleryActions.setFormUid('aaa');
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(true);
      chai.expect(galleryStore.state.galleries.length).to.equal(0);
    });
  });

  describe('building gallery data', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_1_1, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
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
      mockResponse('/assets/aaa/attachments', response_1_1, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
    });

    it('should select media', () => {
      chai.expect(galleryStore.state.selectedMedia.isLoading).to.equal(true);
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(null);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(null);
      chai.expect(galleryStore.state.selectedMedia.data).to.equal(null);

      galleryActions.openMediaModal({galleryIndex: 0, mediaIndex: 0});

      chai.expect(galleryStore.state.selectedMedia.isLoading).to.equal(false);
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(0);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(0);
      chai.expect(galleryStore.state.selectedMedia.data).not.to.equal(null);
      chai.expect(galleryStore.state.selectedMedia.isFirst).to.equal(true);
      chai.expect(galleryStore.state.selectedMedia.isLast).to.equal(true);
      chai.expect(galleryStore.state.selectedMedia.isFirstInGallery).to.equal(true);
      chai.expect(galleryStore.state.selectedMedia.isLastInGallery).to.equal(true);
    });
  });

  describe('selectGalleryMedia action', () => {
    it('should produce new SelectedMedia', (done) => {
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(null);

      mockResponse('/assets/aaa/attachments', response_2_6, () => {
        galleryActions.selectGalleryMedia({galleryIndex: 1, mediaIndex: 1});
        chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(1);
        galleryActions.selectGalleryMedia({galleryIndex: 1, mediaIndex: 3});
        chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(3);
        $.mockjax.clear();
        done();
      });
      galleryActions.setFormUid('aaa');
    });

    it('should produce pending SelectedMedia if media or gallery not present in loaded data and call for new data', (done) => {
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(null);

      mockResponse('/assets/aaa/attachments', response_1_1_next, () => {
        galleryActions.selectGalleryMedia({galleryIndex: 0, mediaIndex: 0});
        chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(0);
        chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(0);
        chai.expect(galleryStore.state.selectedMedia.data).not.to.equal(null);
        chai.expect(galleryStore.state.selectedMedia.isLoading).to.equal(false);

        mockResponse('/assets/aaa/attachments_next', response_2_6, () => {
          chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
          chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(3);
          chai.expect(galleryStore.state.selectedMedia.data).not.to.equal(null);
          chai.expect(galleryStore.state.selectedMedia.isLoading).to.equal(false);
          $.mockjax.clear();
          done();
        });
        galleryActions.selectGalleryMedia({galleryIndex: 1, mediaIndex: 3});
        chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
        chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(3);
        chai.expect(galleryStore.state.selectedMedia.data).to.equal(null);
        chai.expect(galleryStore.state.selectedMedia.isLoading).to.equal(true);
      });
      galleryActions.setFormUid('aaa');
    });
  });

  describe('selectPreviousGalleryMedia action', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_2_6, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
    });

    it('should select last media from previous gallery if on first media', () => {
      galleryActions.selectGalleryMedia({galleryIndex: 1, mediaIndex: 0});
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(0);
      galleryActions.selectPreviousGalleryMedia();
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(0);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(0);
    });

    it('should select previous media', () => {
      galleryActions.selectGalleryMedia({galleryIndex: 1, mediaIndex: 4});
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(4);
      galleryActions.selectPreviousGalleryMedia();
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(3);
    });
  });

  describe('selectNextGalleryMedia action', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_2_6, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
    });

    it('should select first media from next gallery if on last media', () => {
      galleryActions.selectGalleryMedia({galleryIndex: 0, mediaIndex: 0});
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(0);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(0);
      galleryActions.selectNextGalleryMedia();
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(0);
    });

    it('should select next media', () => {
      galleryActions.selectGalleryMedia({galleryIndex: 1, mediaIndex: 3});
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(3);
      galleryActions.selectNextGalleryMedia();
      chai.expect(galleryStore.state.selectedMedia.galleryIndex).to.equal(1);
      chai.expect(galleryStore.state.selectedMedia.mediaIndex).to.equal(4);
    });
  });

  describe('setFilters action', () => {
    afterEach(() => {
      chai.spy.restore(galleryStore, 'wipeAndLoadData');
    });

    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_2_6, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
    });

    it('should wipe and load new data when filterGroupBy changes', (done) => {
      chai.spy.on(galleryStore, 'wipeAndLoadData');
      mockResponse('/assets/aaa/attachments', response_2_6, () => {
        chai.expect(galleryStore.wipeAndLoadData).to.have.been.called();
        chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
        chai.expect(galleryStore.state.galleries.length).to.equal(2);
        done();
      });
      galleryActions.setFilters({filterGroupBy: GROUPBY_OPTIONS.submission.value});
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(true);
      chai.expect(galleryStore.state.galleries.length).to.equal(0);
    });

    it('should wipe and load new data when filterOrder changes', (done) => {
      chai.spy.on(galleryStore, 'wipeAndLoadData');
      mockResponse('/assets/aaa/attachments', response_2_6, () => {
        chai.expect(galleryStore.wipeAndLoadData).to.have.been.called();
        chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
        chai.expect(galleryStore.state.galleries.length).to.equal(2);
        done();
      });
      galleryActions.setFilters({filterOrder: ORDER_OPTIONS.desc.value});
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(true);
      chai.expect(galleryStore.state.galleries.length).to.equal(0);
    });

    it('should wipe and load new data when filterAllVersions changes', (done) => {
      chai.spy.on(galleryStore, 'wipeAndLoadData');
      mockResponse('/assets/aaa/attachments', response_2_6, () => {
        chai.expect(galleryStore.wipeAndLoadData).to.have.been.called();
        chai.expect(galleryStore.state.isLoadingGalleries).to.equal(false);
        chai.expect(galleryStore.state.galleries.length).to.equal(2);
        done();
      });
      galleryActions.setFilters({filterAllVersions: false});
      chai.expect(galleryStore.state.isLoadingGalleries).to.equal(true);
      chai.expect(galleryStore.state.galleries.length).to.equal(0);
    });

    it('should update filtered galleries when filterQuery changes', () => {
      chai.expect(galleryStore.state.filteredMediaCount).to.equal(6);
      chai.expect(galleryStore.state.filteredGalleries.length).to.equal(2);
      galleryActions.setFilters({filterQuery: 'fingers'});
      chai.expect(galleryStore.state.filteredMediaCount).to.equal(5);
      chai.expect(galleryStore.state.filteredGalleries.length).to.equal(1);
    });
  });

  describe('loadMoreGalleries action', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_1_1, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
    });

    it('should throw if no more galleries to load', () => {
      chai.expect(galleryActions.loadMoreGalleries).to.throw('No more galleries to load!');
    });
  });

  describe('loadMoreGalleryMedias action', () => {
    beforeEach((done) => {
      mockResponse('/assets/aaa/attachments', response_1_1, done);
      galleryActions.setFormUid('aaa');
      $.mockjax.clear();
    });

    it('should throw if no more medias to load', () => {
      chai.expect(() => {galleryActions.loadMoreGalleryMedias(0)}).to.throw('No more gallery medias to load!');
    });
  });
});
