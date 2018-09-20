function (user, context, callback) {
    var uuid = require("uuid");
    var connection = mysql({
        host: 'taskular-dev.c7lxo5p3ehzp.ap-southeast-2.rds.amazonaws.com',
        user: 'auth0_rules',
        password: 'GnVqYZ6cbtDy',
        database: 'dashboard',
        port: '3273'
    });
    connection.connect();
    var query = "SELECT idCustomer,ididentityRelationship " +
        "FROM user WHERE email = ?";
    user.app_metadata = user.app_metadata || {};
    user.user_metadata = user.user_metadata || {};

    var namespace = "https://excellence.auth0.com/";
    connection.query(query, [user.email], function (err, results) {
        if (err) return callback(err);
        if (!results.length) {
            var name = user.name.split(" ");
            var query = "insert INTO user (idCustomer,email, firstName, surname) values(?,?,?,?)";
            connection.query(query, [uuid(), user.email, name[0], name[1]], function (err, result) {
                console.log(err);
                user.user_metadata.idCustomer = result.insertId;
                auth0.users.updateUserMetadata(user.user_id, user.user_metadata)
                    .then(function () {
                        context.idToken[namespace + 'user_metadata'] = user.user_metadata;
                        callback(null, user, context);
                    })
                    .catch(function (err) {
                        callback(err);
                    });
            });
        } else {
            var user_metadata = results[0];
            if (user_metadata && user_metadata.ididentityRelationship) {
                var find_user_relationship = 'select relationshipKey, companyId from identityRelationship where parentID=? AND type=?';
                connection.query(find_user_relationship, [user_metadata.ididentityRelationship, 'role'], function (err, idr) {
                    var relationship_ids = [];
                    for (var i = 0; i < idr.length; i++) {
                        if (idr[i].relationshipKey !== null) {
                            relationship_ids.push(idr[i].relationshipKey);
                        }
                    }
                    var role_query = 'select * from role where idRole IN (?)';
                    connection.query(role_query, [relationship_ids], function (err, roles) {
                        if (roles && roles.length) {
                            for (var j = 0; j < idr.length; j++) {
                                for (var i = 0; i < roles.length; i++) {
                                    if (roles[i].idRole === idr[j].relationshipKey) {
                                        Object.assign(idr[j], roles[i]);
                                    }
                                }
                            }
                        }
                        user.app_metadata.roles = idr;
                        auth0.users.updateAppMetadata(user.user_id, user.app_metadata)
                            .then(function () {
                                user.user_metadata.idCustomer = user_metadata.idCustomer;
                                context.idToken[namespace + 'user_metadata'] = user.user_metadata;
                                context.idToken['https://taskular.com/roles'] = user.app_metadata.roles;
                                callback(null, user, context);
                            })
                            .catch(function (err) {
                                callback(err);
                            });
                    });
                });
            } else {
                auth0.users.updateUserMetadata(user.user_id, user.user_metadata)
                    .then(function () {
                        user.user_metadata.idCustomer = user_metadata.idCustomer;
                        context.idToken[namespace + 'user_metadata'] = user.user_metadata;
                        callback(null, user, context);
                    })
                    .catch(function (err) {
                        callback(err);
                    });
            }
        }
    });
}