define(function() {
	var	Topic = {},
		infiniteLoaderActive = false;


	Topic.init = function() {
		var expose_tools = templates.get('expose_tools'),
			tid = templates.get('topic_id'),
			postListEl = document.getElementById('post-container'),
			editBtns = document.querySelectorAll('#post-container .post-buttons .edit, #post-container .post-buttons .edit i'),
			thread_state = {
				locked: templates.get('locked'),
				deleted: templates.get('deleted'),
				pinned: templates.get('pinned')
			},
			topic_name = templates.get('topic_name'),
			twitter_url = templates.get('twitter-intent-url'),
			facebook_url = templates.get('facebook-share-url'),
			google_url = templates.get('google-share-url');


		function fixDeleteStateForPosts() {
			var postEls = document.querySelectorAll('#post-container li[data-deleted]');
			for (var x = 0, numPosts = postEls.length; x < numPosts; x++) {
				if (postEls[x].getAttribute('data-deleted') === '1') {
					toggle_post_delete_state(postEls[x].getAttribute('data-pid'));
				}
				postEls[x].removeAttribute('data-deleted');
			}
		}


		jQuery('document').ready(function() {

			app.addCommasToNumbers();

			app.enterRoom('topic_' + tid);

			if($('#post-container .posts .post-row').length > 1) {
				$('.topic-main-buttons').removeClass('hide').parent().removeClass('hide');
			}

			$('.twitter-share').on('click', function () {
				window.open(twitter_url, '_blank', 'width=550,height=420,scrollbars=no,status=no');
				return false;
			});

			$('.facebook-share').on('click', function () {
				window.open(facebook_url, '_blank', 'width=626,height=436,scrollbars=no,status=no');
				return false;
			});

			$('.google-share').on('click', function () {
				window.open(google_url, '_blank', 'width=500,height=570,scrollbars=no,status=no');
				return false;
			});

			// Resetting thread state
			if (thread_state.locked === '1') set_locked_state(true);
			if (thread_state.deleted === '1') set_delete_state(true);
			if (thread_state.pinned === '1') set_pinned_state(true);

			if (expose_tools === '1') {
				var moveThreadModal = $('#move_thread_modal');
				$('.thread-tools').removeClass('hide');

				// Add events to the thread tools
				$('.delete_thread').on('click', function(e) {
					if (thread_state.deleted !== '1') {
						bootbox.confirm('이 스레드를 삭제 할까요??', function(confirm) {
							if (confirm) {
								socket.emit('api:topic.delete', {
									tid: tid
								});
							}
						});
					} else {
						bootbox.confirm('이 스레드를 복구 할까요??', function(confirm) {
							if (confirm) socket.emit('api:topic.restore', {
								tid: tid
							});
						});
					}
					return false;
				});

				$('.lock_thread').on('click', function(e) {
					if (thread_state.locked !== '1') {
						socket.emit('api:topic.lock', {
							tid: tid
						});
					} else {
						socket.emit('api:topic.unlock', {
							tid: tid
						});
					}
					return false;
				});

				$('.pin_thread').on('click', function(e) {
					if (thread_state.pinned !== '1') {
						socket.emit('api:topic.pin', {
							tid: tid
						});
					} else {
						socket.emit('api:topic.unpin', {
							tid: tid
						});
					}
					return false;
				});

				$('.move_thread').on('click', function(e) {
					moveThreadModal.modal('show');
					return false;
				});

				moveThreadModal.on('shown.bs.modal', function() {

					var loadingEl = document.getElementById('categories-loading');
					if (loadingEl) {
						socket.once('api:categories.get', function(data) {
							// Render categories
							var categoriesFrag = document.createDocumentFragment(),
								categoryEl = document.createElement('li'),
								numCategories = data.categories.length,
								modalBody = moveThreadModal.find('.modal-body'),
								categoriesEl = modalBody[0].getElementsByTagName('ul')[0],
								confirmDiv = document.getElementById('move-confirm'),
								confirmCat = confirmDiv.getElementsByTagName('span')[0],
								commitEl = document.getElementById('move_thread_commit'),
								cancelEl = document.getElementById('move_thread_cancel'),
								x, info, targetCid, targetCatLabel;

							categoriesEl.className = 'category-list';
							for (x = 0; x < numCategories; x++) {
								info = data.categories[x];
								categoryEl.style.background = info.bgColor;
								categoryEl.style.color = info.color || '#fff';
								categoryEl.className = info.disabled === '1' ? ' disabled' : '';
								categoryEl.innerHTML = '<i class="fa ' + info.icon + '"></i> ' + info.name;
								categoryEl.setAttribute('data-cid', info.cid);
								categoriesFrag.appendChild(categoryEl.cloneNode(true));
							}
							categoriesEl.appendChild(categoriesFrag);
							modalBody[0].removeChild(loadingEl);

							categoriesEl.addEventListener('click', function(e) {
								if (e.target.nodeName === 'LI') {
									confirmCat.innerHTML = e.target.innerHTML;
									confirmDiv.style.display = 'block';
									targetCid = e.target.getAttribute('data-cid');
									targetCatLabel = e.target.innerHTML;
									commitEl.disabled = false;
								}
							}, false);

							commitEl.addEventListener('click', function() {
								if (!commitEl.disabled && targetCid) {
									commitEl.disabled = true;
									$(cancelEl).fadeOut(250);
									$(moveThreadModal).find('.modal-header button').fadeOut(250);
									commitEl.innerHTML = 'Moving <i class="fa-spin fa-refresh"></i>';

									socket.once('api:topic.move', function(data) {
										moveThreadModal.modal('hide');
										if (data.status === 'ok') {
											app.alert({
												'alert_id': 'thread_move',
												type: 'success',
												title: '글이 이동 되었습니다.',
												message: '이 글이 ' + targetCatLabel + " 로 이동 되었습니다. ",
												timeout: 5000
											});
										} else {
											app.alert({
												'alert_id': 'thread_move',
												type: 'danger',
												title: '이동 불가',
												message: '이 글이 ' + targetCatLabel + " 로 이동이 안됩니다. "+ '.<br />나중에 다시 시도 해 주세요.',
												timeout: 5000
											});
										}
									});
									socket.emit('api:topic.move', {
										tid: tid,
										cid: targetCid
									});
								}
							});
						});
						socket.emit('api:categories.get');
					}
				});
			}

			fixDeleteStateForPosts();


			// Follow Thread State
			var followEl = $('.posts .follow'),
				set_follow_state = function(state, quiet) {
					if (state && !followEl.hasClass('btn-success')) {
						followEl.addClass('btn-success');
						followEl[0].title = '이 글을 업데이트 중입니다.';
						if (!quiet) {
							app.alert({
								alert_id: 'topic_follow',
								timeout: 2500,
								title: '이 글 팔로우 하기',
								message: '이 글에 누군가 글을 남기면 알려 드려요.',
								type: 'success'
							});
						}
					} else if (!state && followEl.hasClass('btn-success')) {
						followEl.removeClass('btn-success');
						followEl[0].title = '이 글에 답글 달면 알려 주기';
						if (!quiet) {
							app.alert({
								alert_id: 'topic_follow',
								timeout: 2500,
								title: '이 글 언팔 하기',
								message: '이 글 알림을 더이상 받지 않습니다.',
								type: 'success'
							});
						}
					}
				};
			socket.on('api:topic.followCheck', function(state) {
				set_follow_state(state, true);
			});
			socket.on('api:topic.follow', function(data) {
				if (data.status && data.status === 'ok') set_follow_state(data.follow);
				else {
					app.alert({
						type: 'danger',
						alert_id: 'topic_follow',
						title: '로그인 하세요.',
						message: '이 글을 구독 하시려면 가입을 하시거나 로그인을 하세요.',
						timeout: 5000
					});
				}
			});

			socket.emit('api:topic.followCheck', tid);
			if (followEl[0]) {
				followEl[0].addEventListener('click', function() {
					socket.emit('api:topic.follow', tid);
				}, false);
			}

			enableInfiniteLoading();

			var bookmark = localStorage.getItem('topic:' + tid + ':bookmark');

			if(bookmark) {
				Topic.scrollToPost(parseInt(bookmark, 10));
			}

			$('#post-container').on('click', '.deleted', function(ev) {
				$(this).toggleClass('deleted-expanded');
			});
		});

		function enableInfiniteLoading() {
			$(window).off('scroll').on('scroll', function() {
				var bottom = ($(document).height() - $(window).height()) * 0.9;

				if ($(window).scrollTop() > bottom && !infiniteLoaderActive && $('#post-container').children().length) {
					loadMorePosts(tid, function(posts) {
						fixDeleteStateForPosts();
					});
				}
			});
		}

		$('.topic').on('click', '.post_reply', function() {
			var selectionText = '',
				selection = window.getSelection() || document.getSelection();

			if ($(selection.baseNode).parents('.post-content').length > 0) {
				var snippet = selection.toString();
				if (snippet.length > 0) selectionText = '> ' + snippet.replace(/\n/g, '\n> ');
			}

			if (thread_state.locked !== '1') {
				require(['composer'], function(cmp) {
					cmp.push(tid, null, null, selectionText.length > 0 ? selectionText + '\n\n' : '');
				});
			}
		});

		$('#post-container').on('click', '.quote', function() {
			if (thread_state.locked !== '1') {
				var pid = $(this).parents('li').attr('data-pid');

				socket.once('api:posts.getRawPost', function(data) {

					quoted = '> ' + data.post.replace(/\n/g, '\n> ') + '\n\n';
					require(['composer'], function(cmp) {
						cmp.push(tid, null, null, quoted);
					});
				});
				socket.emit('api:posts.getRawPost', {
					pid: pid
				});
			}
		});

		$('#post-container').on('click', '.favourite', function() {
			var pid = $(this).parents('li').attr('data-pid');
			var uid = $(this).parents('li').attr('data-uid');

			var element = $(this).find('i');
			if ($(element).hasClass('fa-star-o')) {
				socket.emit('api:posts.favourite', {
					pid: pid,
					room_id: app.currentRoom
				});
			} else {
				socket.emit('api:posts.unfavourite', {
					pid: pid,
					room_id: app.currentRoom
				});
			}
		});

		$('#post-container').on('click', '.link', function() {
			var pid = $(this).parents('li').attr('data-pid');
			$('#post_' + pid + '_link').val(window.location.href + "#" + pid).stop(true, false).fadeIn().select();
			$('#post_' + pid + '_link').off('blur').on('blur', function() {
				$(this).fadeOut();
			});
		});

		$('#post-container').delegate('.edit', 'click', function(e) {
			var pid = $(this).parents('li').attr('data-pid'),
				main = $(this).parents('.posts');

			require(['composer'], function(cmp) {
				cmp.push(null, null, pid);
			});
		});

		$('#post-container').delegate('.delete', 'click', function(e) {
			var pid = $(this).parents('li').attr('data-pid'),
				postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
				deleteAction = !postEl.hasClass('deleted') ? true : false,
				confirmDel = confirm((deleteAction ? 'Delete' : 'Restore') + ' this post?');

			if (confirmDel) {
				if(deleteAction) {
					socket.emit('api:posts.delete', {
						pid: pid,
						tid: tid
					}, function(err) {
						if(err) {
							return app.alertError('Can\'t delete post!');
						}
					});
				} else {
					socket.emit('api:posts.restore', {
						pid: pid,
						tid: tid
					}, function(err) {
						if(err) {
							return app.alertError('Can\'t restore post!');
						}
					});
				}
			}
		});

		$('#post-container').on('click', '.chat', function(e) {
			var username = $(this).parents('li.row').attr('data-username');
			var touid = $(this).parents('li.row').attr('data-uid');

			app.openChat(username, touid);
		});

		ajaxify.register_events([
			'event:rep_up', 'event:rep_down', 'event:new_post', 'api:get_users_in_room',
			'event:topic_deleted', 'event:topic_restored', 'event:topic:locked',
			'event:topic_unlocked', 'event:topic_pinned', 'event:topic_unpinned',
			'event:topic_moved', 'event:post_edited', 'event:post_deleted', 'event:post_restored',
			'api:posts.favourite'
		]);


		socket.on('api:get_users_in_room', function(data) {
			if(data) {
				var activeEl = $('.thread_active_users');

				function createUserIcon(uid, picture, userslug, username) {
					if(!activeEl.find("[href='/user/"+ data.users[i].userslug + "']").length) {
						var userIcon = $('<img src="'+ picture +'"/>');

						var userLink = $('<a href="/user/' + userslug + '"></a>').append(userIcon);
						userLink.attr('data-uid', uid);

						var div = $('<div class="inline-block"></div>');
						div.append(userLink);

						userLink.tooltip({
							placement: 'top',
							title: username
						});

						return div;
					}
				}

				// remove users that are no longer here
				activeEl.children().each(function(index, element) {
					if(element) {
						var uid = $(element).attr('data-uid');
						for(var i=0; i<data.users.length; ++i) {
							if(data.users[i].uid == uid) {
								return;
							}
						}
						$(element).remove();
					}
				});

				var i=0;
				// add self
				for(i = 0; i<data.users.length; ++i) {
					if(data.users[i].uid == app.uid) {
						var icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username);
						activeEl.prepend(icon);
						data.users.splice(i, 1);
						break;
					}
				}
				// add other users
				for(i=0; i<data.users.length; ++i) {
					icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username)
					activeEl.append(icon);
					if(activeEl.children().length > 8) {
						break;
					}
				}

				var remainingUsers = data.users.length - 9;
				remainingUsers = remainingUsers < 0 ? 0 : remainingUsers;
				var anonymousCount = parseInt(data.anonymousCount, 10);
				activeEl.find('.anonymous-box').remove();
				if(anonymousCount || remainingUsers) {

					var anonLink = $('<div class="anonymous-box inline-block"><i class="fa fa-user"></i></div>');
					activeEl.append(anonLink);

					var title = '';
					if(remainingUsers && anonymousCount)
						title = remainingUsers + ' more user(s) and ' + anonymousCount + ' guest(s)';
					else if(remainingUsers)
						title = remainingUsers + ' more user(s)';
					else
						title = anonymousCount + ' guest(s)';

					anonLink.tooltip({
						placement: 'top',
						title: title
					});
				}
			}
			app.populateOnlineUsers();
		});

		socket.on('event:rep_up', function(data) {
			adjust_rep(1, data.pid, data.uid);
		});

		socket.on('event:rep_down', function(data) {
			adjust_rep(-1, data.pid, data.uid);
		});

		socket.on('event:new_post', createNewPosts);

		socket.on('event:topic_deleted', function(data) {
			if (data.tid === tid && data.status === 'ok') {
				set_locked_state(true);
				set_delete_state(true);
			}
		});

		socket.on('event:topic_restored', function(data) {
			if (data.tid === tid && data.status === 'ok') {
				set_locked_state(false);
				set_delete_state(false);
			}
		});

		socket.on('event:topic_locked', function(data) {
			if (data.tid === tid && data.status === 'ok') {
				set_locked_state(true, 1);
			}
		});

		socket.on('event:topic_unlocked', function(data) {
			if (data.tid === tid && data.status === 'ok') {
				set_locked_state(false, 1);
			}
		});

		socket.on('event:topic_pinned', function(data) {
			if (data.tid === tid && data.status === 'ok') {
				set_pinned_state(true, 1);
			}
		});

		socket.on('event:topic_unpinned', function(data) {
			if (data.tid === tid && data.status === 'ok') {
				set_pinned_state(false, 1);
			}
		});

		socket.on('event:topic_moved', function(data) {
			if (data && data.tid > 0) ajaxify.go('topic/' + data.tid);
		});

		socket.on('event:post_edited', function(data) {
			var editedPostEl = document.getElementById('content_' + data.pid);

			var editedPostTitle = $('#topic_title_' + data.pid);

			if (editedPostTitle.length > 0) {
				editedPostTitle.fadeOut(250, function() {
					editedPostTitle.html(data.title);
					editedPostTitle.fadeIn(250);
				});
			}

			$(editedPostEl).fadeOut(250, function() {
				this.innerHTML = data.content;
				$(this).fadeIn(250);
			});

		});

		socket.on('api:posts.favourite', function(data) {
			if (data.status === 'ok' && data.pid) {
				var favEl = document.querySelector('.post_rep_' + data.pid).nextSibling;
				if (favEl) {
					favEl.className = 'fa fa-star';
					$(favEl).parent().addClass('btn-warning');
				}
			}
		});

		socket.on('api:posts.unfavourite', function(data) {
			if (data.status === 'ok' && data.pid) {
				var favEl = document.querySelector('.post_rep_' + data.pid).nextSibling;
				if (favEl) {
					favEl.className = 'fa fa-star-o';
					$(favEl).parent().removeClass('btn-warning');
				}
			}
		});

		socket.on('event:post_deleted', function(data) {
			if (data.pid) {
				 toggle_post_delete_state(data.pid);
			}
		});

		socket.on('event:post_restored', function(data) {
			if (data.pid) {
				toggle_post_delete_state(data.pid);
			}
		});

		socket.on('api:post.privileges', function(privileges) {
			toggle_mod_tools(privileges.pid, privileges.editable);
		});

		function adjust_rep(value, pid, uid) {
			var post_rep = jQuery('.post_rep_' + pid),
				user_rep = jQuery('.user_rep_' + uid);

			var ptotal = parseInt(post_rep.html(), 10),
				utotal = parseInt(user_rep.html(), 10);

			ptotal += value;
			utotal += value;

			post_rep.html(ptotal + ' ');
			user_rep.html(utotal + ' ');
		}

		function set_locked_state(locked, alert) {
			var threadReplyBtn = $('.topic-main-buttons .post_reply'),
				postReplyBtns = document.querySelectorAll('#post-container .post_reply'),
				quoteBtns = document.querySelectorAll('#post-container .quote'),
				editBtns = document.querySelectorAll('#post-container .edit'),
				deleteBtns = document.querySelectorAll('#post-container .delete'),
				numPosts = document.querySelectorAll('#post_container li[data-pid]').length,
				lockThreadEl = $('.lock_thread'),
				x;

			if (locked === true) {
				lockThreadEl.html('<i class="fa fa-unlock"></i> Unlock Thread');
				threadReplyBtn.attr('disabled', true);
				threadReplyBtn.html('Locked <i class="fa fa-lock"></i>');
				for (x = 0; x < numPosts; x++) {
					postReplyBtns[x].innerHTML = 'Locked <i class="fa fa-lock"></i>';
					quoteBtns[x].style.display = 'none';
					editBtns[x].style.display = 'none';
					deleteBtns[x].style.display = 'none';
				}

				if (alert) {
					app.alert({
						'alert_id': 'thread_lock',
						type: 'success',
						title: 'Thread Locked',
						message: 'Thread has been successfully locked',
						timeout: 5000
					});
				}

				thread_state.locked = '1';
			} else {
				lockThreadEl.html('<i class="fa fa-lock"></i> Lock Thread');
				threadReplyBtn.attr('disabled', false);
				threadReplyBtn.html('Reply');
				for (x = 0; x < numPosts; x++) {
					postReplyBtns[x].innerHTML = 'Reply <i class="fa fa-reply"></i>';
					quoteBtns[x].style.display = 'inline-block';
					editBtns[x].style.display = 'inline-block';
					deleteBtns[x].style.display = 'inline-block';
				}

				if (alert) {
					app.alert({
						'alert_id': 'thread_lock',
						type: 'success',
						title: 'Thread Unlocked',
						message: 'Thread has been successfully unlocked',
						timeout: 5000
					});
				}

				thread_state.locked = '0';
			}
		}

		function set_delete_state(deleted) {
			var deleteThreadEl = $('.delete_thread'),
				deleteTextEl = $('.delete_thread span'),
				//deleteThreadEl.getElementsByTagName('span')[0],
				threadEl = $('#post-container'),
				deleteNotice = document.getElementById('thread-deleted') || document.createElement('div');

			if (deleted) {
				deleteTextEl.html('<i class="fa fa-comment"></i> Restore Thread');
				threadEl.addClass('deleted');

				// Spawn a 'deleted' notice at the top of the page
				deleteNotice.setAttribute('id', 'thread-deleted');
				deleteNotice.className = 'alert alert-warning';
				deleteNotice.innerHTML = '이 글은 삭제 되었습니다. 이 글에 권한이 있는 사람만 볼 수 있습니다.';
				threadEl.before(deleteNotice);

				thread_state.deleted = '1';
			} else {
				deleteTextEl.html('<i class="fa fa-trash-o"></i> Delete Thread');
				threadEl.removeClass('deleted');
				deleteNotice.parentNode.removeChild(deleteNotice);

				thread_state.deleted = '0';
			}
		}

		function set_pinned_state(pinned, alert) {
			var pinEl = $('.pin_thread');

			if (pinned) {
				pinEl.html('<i class="fa fa-thumb-tack"></i> 핀 해제');
				if (alert) {
					app.alert({
						'alert_id': 'thread_pin',
						type: 'success',
						title: '이 글 핀으로 고정 하기',
						message: '이 글을 핀으로 고정 하였습니다.',
						timeout: 5000
					});
				}

				thread_state.pinned = '1';
			} else {
				pinEl.html('<i class="fa fa-thumb-tack"></i> 글 핀');
				if (alert) {
					app.alert({
						'alert_id': 'thread_pin',
						type: 'success',
						title: '이 글 핀으로 고정 취소 하기',
						message: '이 글 핀으로 고정 하기를 취소 했습니다.',
						timeout: 5000
					});
				}

				thread_state.pinned = '0';
			}
		}

		function toggle_post_delete_state(pid) {
			var postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]'));

			if (postEl[0]) {
				quoteEl = $(postEl[0].querySelector('.quote')),
				favEl = $(postEl[0].querySelector('.favourite')),
				replyEl = $(postEl[0].querySelector('.post_reply'));

				socket.once('api:post.privileges', function(privileges) {
					if (privileges.editable) {
						if (!postEl.hasClass('deleted')) {
							toggle_post_tools(pid, false);
						} else {
							toggle_post_tools(pid, true);
						}
					}

					if (privileges.view_deleted) {
						postEl.toggleClass('deleted');
					} else {
						postEl.toggleClass('none');
					}
					updatePostCount();
				});
				socket.emit('api:post.privileges', pid);
			}
		}

		function toggle_post_tools(pid, state) {
			var postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
				quoteEl = $(postEl[0].querySelector('.quote')),
				favEl = $(postEl[0].querySelector('.favourite')),
				replyEl = $(postEl[0].querySelector('.post_reply'));

			if (state) {
				quoteEl.removeClass('none');
				favEl.removeClass('none');
				replyEl.removeClass('none');
			} else {
				quoteEl.addClass('none');
				favEl.addClass('none');
				replyEl.addClass('none');
			}
		}

		function toggle_mod_tools(pid, state) {
			var postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
				editEl = postEl.find('.edit'),
				deleteEl = postEl.find('.delete');

			if (state) {
				editEl.removeClass('none');
				deleteEl.removeClass('none');
			} else {
				editEl.addClass('none');
				deleteEl.addClass('none');
			}
		}



		var pagination;
		Topic.postCount = templates.get('postcount');

		function updateHeader() {
			if (pagination == null) {
				jQuery('.pagination-block i:first').on('click', function() {
					app.scrollToTop();
				});
				jQuery('.pagination-block i:last').on('click', function() {
					app.scrollToBottom();
				});
			}
			pagination = pagination || document.getElementById('pagination');

			pagination.parentNode.style.display = 'block';

			var windowHeight = jQuery(window).height();
			var scrollTop = jQuery(window).scrollTop();
			var scrollBottom = scrollTop + windowHeight;

			if (scrollTop < 50 && Topic.postCount > 1) {
				localStorage.removeItem("topic:" + tid + ":bookmark");
				pagination.innerHTML = '0 out of ' + Topic.postCount;
				return;
			}


			var count = 0, smallestNonNegative = 0;

			jQuery('.posts > .post-row').each(function() {
				count++;
				this.postnumber = count;


				var el = jQuery(this);
				var elTop = el.offset().top;
				var height = Math.floor(el.height());
				var elBottom = elTop + (height < 300 ? height : 300);

				var inView = ((elBottom >= scrollTop) && (elTop <= scrollBottom) && (elBottom <= scrollBottom) && (elTop >= scrollTop));


				if (inView) {
					if(elTop - scrollTop > smallestNonNegative) {
						localStorage.setItem("topic:" + tid + ":bookmark", el.attr('data-pid'));
						smallestNonNegative = Number.MAX_VALUE;
					}

					pagination.innerHTML = this.postnumber + ' out of ' + Topic.postCount;
				}
			});

			setTimeout(function() {
				if (scrollTop + windowHeight == jQuery(document).height()) {
					pagination.innerHTML = Topic.postCount + ' out of ' + Topic.postCount;
				}
			}, 100);
		}

		window.onscroll = updateHeader;
		window.onload = updateHeader;
	};

	Topic.scrollToPost = function(pid) {
		if (!pid) {
			return;
		}

		var container = $(document.body),
			scrollTo = $('#post_anchor_' + pid),
			tid = $('#post-container').attr('data-tid');

		function animateScroll() {
			$('body,html').animate({
				scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop() - $('#header-menu').height()
			}, 400);
		}

		if (!scrollTo.length && tid) {

			var intervalID = setInterval(function () {
				loadMorePosts(tid, function (posts) {
					scrollTo = $('#post_anchor_' + pid);

					if (tid && scrollTo.length) {
						animateScroll();
					}

					if (!posts.length || scrollTo.length)
						clearInterval(intervalID);
				});
			}, 100);

		} else if (tid) {
			animateScroll();
		}
	}

	function createNewPosts(data, infiniteLoaded) {
		if(!data || (data.posts && !data.posts.length))
			return;

		if (data.posts[0].uid !== app.uid) {
			data.posts[0].display_moderator_tools = 'none';
		}

		function removeAlreadyAddedPosts() {
			data.posts = data.posts.filter(function(post) {
				return $('#post-container li[data-pid="' + post.pid +'"]').length === 0;
			});
		}

		function findInsertionPoint() {
			var after = null,
				firstPid = data.posts[0].pid;
			$('#post-container li[data-pid]').each(function() {
				if(parseInt(firstPid, 10) > parseInt($(this).attr('data-pid'), 10)) {
					after = $(this);
					if(after.hasClass('posts')) {
						after = after.next();
					}
				} else {
					return false;
				}
			});
			return after;
		}

		removeAlreadyAddedPosts();
		if(!data.posts.length) {
			return;
		}

		var insertAfter = findInsertionPoint();

		var html = templates.prepare(templates['topic'].blocks['posts']).parse(data);
		var regexp = new RegExp("<!--[\\s]*IF @first[\\s]*-->[\\s\\S]*<!--[\\s]*ENDIF @first[\\s]*-->", 'g');
		html = html.replace(regexp, '');

		translator.translate(html, function(translatedHTML) {
			var translated = $(translatedHTML);

			if(!infiniteLoaded) {
				translated.removeClass('infiniteloaded');
			}

			translated.insertAfter(insertAfter)
				.hide()
				.fadeIn('slow');

			for (var x = 0, numPosts = data.posts.length; x < numPosts; x++) {
				socket.emit('api:post.privileges', data.posts[x].pid);
			}

			infiniteLoaderActive = false;

			app.populateOnlineUsers();
			app.addCommasToNumbers();
			$('span.timeago').timeago();
			$('.post-content img').addClass('img-responsive');
			updatePostCount();
		});
	}

	function updatePostCount() {
		Topic.postCount = $('#post-container li[data-pid]:not(.deleted)').length;
		$('#topic-post-count').html(Topic.postCount);
	}

	function loadMorePosts(tid, callback) {
		var indicatorEl = $('.loading-indicator');

		if (infiniteLoaderActive) {
			return;
		}

		infiniteLoaderActive = true;

		if (indicatorEl.attr('done') === '0') {
			indicatorEl.fadeIn();
		}

		socket.emit('api:topic.loadMore', {
			tid: tid,
			after: $('#post-container .post-row.infiniteloaded').length
		}, function (data) {
			infiniteLoaderActive = false;
			if (data.posts.length) {
				indicatorEl.attr('done', '0');
				createNewPosts(data, true);
			} else {
				indicatorEl.attr('done', '1');
			}
			indicatorEl.fadeOut();
			if (callback) {
				callback(data.posts);
			}
		});
	}

	return Topic;
});